const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'vendor', 'providers')

function copyDir(from, to) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true })
  for (const f of fs.readdirSync(from)) {
    const s = path.join(from, f)
    const d = path.join(to, f)
    if (fs.statSync(s).isDirectory()) {
      copyDir(s, d)
    } else {
      fs.copyFileSync(s, d)
    }
  }
}

const targets = [
  path.join(__dirname, '..', 'node_modules', '@ethersproject', 'providers'),
  path.join(__dirname, '..', 'node_modules', 'ethers', 'node_modules', '@ethersproject', 'providers'),
]

for (const target of targets) {
  try {
    copyDir(src, target)
  } catch (e) {
    // target may not exist, skip
  }
}
