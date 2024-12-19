
export const isErc1155Address = (address: string) => {
    return /^0x[0-9,a-f,A-Z]{40}-[0-9]{1,}$/g.test(address)
  }
  
  export const decodeErc1155Address = (address: string) => {
    if (!address) return { address: '', id: '' }
    return {
      address: address.split('-')[0],
      id: address.split('-')[1]
    }
  }
  
  export const encodeErc1155Address = (token: string, side: number): string => {
    return token + '-' + side
  }