# tvp-pl-proxy
> A proxy for vod.tvp.pl

The userscript uses the polish proxy to replace the video element on the page with a direct link, in order to bypass the region lock.

The polish proxy pulls proxies from ProxyNova and ranks them by least number of retries as they get used.

### Setup

```
npm install
```

Install the [userscript](https://github.com/patkub/tvp-pl-proxy/raw/master/vod.tvp.pl%20proxy.user.js)

### Run the proxy

```
npm start
```

### Available Commands: 
>  Type these into the window running the proxy and hit enter.

```
refresh or r - refresh proxy list 
priority or p - list proxies by priority 
reset - reset proxy priority
```