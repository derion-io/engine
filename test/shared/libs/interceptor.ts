import { BatchInterceptor } from '@mswjs/interceptors'
import { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest'
import objHash from 'object-hash'
import * as path from 'path'
import * as fs from 'fs'

import dotenv from 'dotenv'
dotenv.config()

export function Interceptor() {
  this.interceptor = new BatchInterceptor({
    name: 'batch-interceptor',
    interceptors: [new ClientRequestInterceptor()],
  })
  this.context = ''
  this.requests = {}
  this.responses = {}

  this.setContext = (context: string) => {
    this.context = (context ?? '').replace(/\s/g, '_')
  }

  this.orphanedRequests = (): any => {
    const requests = { ...this.requests }
    for (const requestId of Object.keys(this.responses)) {
      delete requests[requestId]
    }
    return requests
  }

  this.getResourcePath = (requestId: string, createFolder: boolean = false): string => {
    const filename = `${requestId}.json`
    const root = path.join(__dirname, `../../data`)
    const folder = path.join(root, this.context)
    if (createFolder && !fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true })
    }
    return path.join(folder, filename)
  }

  this.interceptor.apply()

  this.interceptor.on('request', async ({ request }) => {
    if (!this.context) {
      return
    }
    try {
      const requestId = await calcRequestID(request)
      this.requests[requestId] = request
      const resourcePath = this.getResourcePath(requestId)
      if (fs.existsSync(resourcePath)) {
        const resourceData = fs.readFileSync(resourcePath, 'utf8')
        if (resourceData) {
          try {
            const resourceDataJson = JSON.parse(resourceData)
            const response = new Response(JSON.stringify(resourceDataJson.body))
            request.respondWith(response)
            return
          } catch (err) {
            console.error('failed to mock response', err, request)
          }
        }
      } else {
        if (process.env.TRACE) {
          console.log('NEW REQUEST', resourcePath)
        }
      }
    } catch (err) {
      console.error('failed to handle request', err, request)
    }
    if (!process.env.RECORD) {
      console.error('data must be recorded first with `yarn record [-t TestName]`')
      process.exit(1)
    }
  })

  this.interceptor.on('response', async ({ response, isMockedResponse, request }) => {
    const requestId = await calcRequestID(request)
    this.responses[requestId] = response
    const resourcePath = this.getResourcePath(requestId, true)
    if (!this.context) {
      if (process.env.TRACE) {
        console.log('NO CONTEXT', resourcePath, request, response)
      }
      return
    }
    try {
      if (isMockedResponse) {
        return
      }
      if (response.status != 200) {
        if (process.env.TRACE) {
          console.log('!200', response)
        }
        return
      }

      const resourceData = {
        type: response.type,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: {},
      }
      try {
        resourceData.body = await response.clone().json()
      } catch (err) {
        if (err.message.includes('in JSON at position')) {
          resourceData.body = await fetch(request.url).then((r) => r.json())
        } else {
          console.log(err)
        }
      }

      fs.writeFileSync(resourcePath, JSON.stringify(resourceData))
      if (process.env.TRACE) {
        console.log('NEW RESPONSE', resourcePath, resourceData)
      }
    } catch (err) {
      console.log(err, request, response)
    }
  })
}

const calcRequestID = async (request: Request): Promise<string> => {
  let { url, method } = request
  if (method === 'POST') {
    const body = await request.clone().json()
    delete body.id
    const obj = { url, body }
    if (process.env.TRACE) {
      console.log(obj)
    }
    return objHash(obj).substr(0, 8)
  }
  if (url.includes('&apikey=')) {
    url = url.replace(/apikey=[^&]*/g, 'apikey=')
  }
  if (process.env.TRACE) {
    console.log(url)
  }
  return objHash(url).substr(0, 8)
}
