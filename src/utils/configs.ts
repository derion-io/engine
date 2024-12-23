const DDL_CONFIGS_URL = {
  development: `https://raw.githubusercontent.com/derion-io/configs/dev/`,
  production: `https://raw.githubusercontent.com/derion-io/configs/main/`,
}

const loadSDKConfig = async (env: 'development' | 'production', chainId: number) => {
  const [networkConfig, uniV3Pools, whitelistPools] = await Promise.all([
    fetch(DDL_CONFIGS_URL[env] + chainId + '/network.json')
      .then((r) => r.json())
      .catch(() => []),
    fetch(DDL_CONFIGS_URL[env] + chainId + '/routes.json')
      .then((r) => r.json())
      .catch(() => []),
    fetch(DDL_CONFIGS_URL[env] + chainId + '/pools.json')
      .then((r) => r.json())
      .catch(() => []),
  ])
  const configs = networkConfig
  const routes = uniV3Pools
  return {
    configs,
    routes,
    whitelistPools,
  }
}
