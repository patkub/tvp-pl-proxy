/**
 * To use, set
 * window.tvpProxy.PROXY_URL: (url) => `http://localhost:3000/pl/${encodeURIComponent(url)}`
 */

const http = require('http')
const express = require('express')
const router = express.Router()
const app = express()
const axios = require('axios')
const request = require('request')
// proxy nova scrapper
const proxyNova = require('./proxyNova')

const CONFIG = {
    // port to listen on
    PORT: 3000,
    
    // number of top proxies to randomly pick from
    NUM_TOP_PROXIES_PICK_FROM: 4,
    
    // number of milliseconds to wait before trying another proxy
    PROXY_TIMEOUT: 5000 /* 5 seconds */,
    
    // number of retries
    PROXY_RETRY_LIMIT: 30
}

const TVP_PROXY = {
    API_TOKENIZER: (object_id) => `http://www.tvp.pl/shared/cdn/tokenizer_v2.php?object_id=${object_id}`
}

let proxyArray = [];

// don't refresh if previous refresh didn't finish
let finishedRefresh = true;

// map proxy urls to number of retries
let proxyRetriesMap = new Map();

// refresh proxies on startup
refreshProxies();

// refresh proxies every 60 minutes
setInterval(function() {
  refreshProxies();
}, 60 * 60 * 1000);

function refreshProxies() {
  console.log("Refreshing proxies...");
  
  if (finishedRefresh) {
    finishedRefresh = false;
    proxyNova.getProxyNovaList("https://www.proxynova.com/proxy-server-list/country-pl/")
        .then((newProxyArray) => {
            proxyArray = newProxyArray
            
            for (const proxy of proxyArray) {
                const proxyUrl = 'http://' + proxy.ip + ':' + proxy.port
                if (!proxyRetriesMap.has(proxyUrl)) {
                    proxyRetriesMap.set(proxyUrl, 0)
                    proxy.retries = 0
                } else {
                    proxy.retries = proxyRetriesMap.get(proxyUrl)
                }
            }
            
            // sort the proxies
            proxyArray = proxyArray.sort(sortProxiesLeastRetries)
            
            finishedRefresh = true;
            console.log("Updated proxies.");
        })
  }
}

// sort proxies by ascending number of retries
function sortProxiesLeastRetries(a, b) {
  if ( a.retries < b.retries ){
    return -1;
  }
  if ( a.retries > b.retries ){
    return 1;
  }
  return 0;
}

// reset proxies number of retries
function resetProxies() {
    for (const proxy of proxyArray) {
        const proxyUrl = 'http://' + proxy.ip + ':' + proxy.port
        if (proxyRetriesMap.has(proxyUrl)) {
            proxyRetriesMap.set(proxyUrl, 0)
            proxy.retries = 0
        }
    }
    console.log("Reset proxy priorities.");
}

function incrementProxyRetries(proxy, index) {
    proxyRetriesMap.set(proxy, proxyRetriesMap.get(proxy) + 1)
    proxyArray[index].retries += 1   
}

router
  // https://www.proxynova.com/proxy-server-list/country-pl/
  // http://localhost:3000/proxynova/https%3A%2F%2Fwww.proxynova.com%2Fproxy-server-list%2Fcountry-pl%2F
  .get("/proxynova/:url", (req, res) => {
      const url = req.params.url
      const decoded_url = decodeURIComponent(url)
      proxyNova.getProxyNovaList(decoded_url)
        .then((res2) => {
            res.status(200).json(res2)
        })
  })

  // http://localhost:3000/pl/http%3A%2F%2Fwww.tvp.pl%2Fshared%2Fcdn%2Ftokenizer_v2.php%3Fobject_id%3D46749071
  .get("/pl/:url", (req, res) => {
    const url = req.params.url
    const decoded_url = decodeURIComponent(url)
    let num_retries = 0
    let last_req = null;
    
    var retryInterval = setInterval(function() {
        // pick one of the top 4 proxies
        const randProxyIndex = Math.floor(Math.random() * CONFIG.NUM_TOP_PROXIES_PICK_FROM) % proxyArray.length
        const randProxy = 'http://' + proxyArray[randProxyIndex].ip + ':' + proxyArray[randProxyIndex].port
        
        if (last_req) {
            last_req.abort()
            // increment proxy's retries count
            incrementProxyRetries(randProxy, randProxyIndex)
            // re-sort the proxies
            proxyArray = proxyArray.sort(sortProxiesLeastRetries)
            num_retries++
        
            if (num_retries >= CONFIG.PROXY_RETRY_LIMIT) {
                // request failed too many times
                clearInterval(retryInterval);
                console.log("Request failed after " + CONFIG.PROXY_RETRY_LIMIT + " tries.")
                res.status(500)
            }
            console.log("proxy timed out, retrying...")
        }
        
        last_req = request({
            'url': decoded_url,
            'method': "GET",
            'proxy': randProxy,
        },function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log("proxy succeeded")
                clearInterval(retryInterval);
                res.status(200).json(JSON.parse(response.body))
            }
        })
    }, CONFIG.PROXY_TIMEOUT /* delay before trying another proxy */);
  })
  
  // http://localhost:3000/tvppl/tokenizer/45425590
  .get("/tvppl/tokenizer/:objectid", (req, res) => {
      const object_id = req.params.objectid
      let num_retries = 0
      let last_req = null;
      
      var retryInterval = setInterval(function() {
        // pick one of the top 4 proxies
        const randProxyIndex = Math.floor(Math.random() * CONFIG.NUM_TOP_PROXIES_PICK_FROM) % proxyArray.length
        const randProxy = 'http://' + proxyArray[randProxyIndex].ip + ':' + proxyArray[randProxyIndex].port
        
        if (last_req) {
            last_req.abort()
            // increment proxy's retries count
            incrementProxyRetries(randProxy, randProxyIndex)
            // re-sort the proxies
            proxyArray = proxyArray.sort(sortProxiesLeastRetries)
            num_retries++
        
            if (num_retries >= CONFIG.PROXY_RETRY_LIMIT) {
                // request failed too many times
                clearInterval(retryInterval);
                console.log("Request failed after " + CONFIG.PROXY_RETRY_LIMIT + " tries.")
                res.status(500)
            }
            console.log("Proxy timed out, retrying...")
        }
        
        last_req = request({
            'url': TVP_PROXY.API_TOKENIZER(object_id),
            'method': "GET",
            'proxy': randProxy,
        },function (error, response, body) {
            if (!error && response.statusCode == 200) {
                // success
                console.log("Proxy succeeded.")
                clearInterval(retryInterval);
                const r = JSON.parse(response.body)
                
                const data = {}
                
                // bitrates highest to lowest
                const mp4sByBitrate = r['formats']
                    .filter(fmt => fmt.mimeType.toLowerCase() == "video/mp4")
                    .sort((a, b) => (a.totalBitrate > b.totalBitrate) ? -1 : 1)
                    
                // rewrite http to https urls
                for (let i = 0; i < mp4sByBitrate.length; i++) {
                    // must be https because mixed content not allowed on page
                    mp4sByBitrate[i].url = mp4sByBitrate[i].url.replace(/^http:\/\//i, 'https://');
                }
                //console.log(mp4sByBitrate)
                data['formats'] = mp4sByBitrate
                
                // get the manifest
                const manifest = r['formats']
                    .filter(fmt => fmt.mimeType.toLowerCase() == "application/vnd.ms-ss")[0]
                if (manifest) {
                    // must be https because mixed content not allowed on page
                    data['manifest'] = manifest['url'].replace(/^http:\/\//i, 'https://');
                }
                
                console.log("Got video urls path.")
                
                let videos_list = "Available videos: "
                for (const [i, video] of mp4sByBitrate.entries()) {
                    if (i > 0) videos_list += ", "
                    videos_list += video['url'].substring(video['url'].lastIndexOf("/") + 1, video['url'].length)
                }
                console.log(videos_list)
                if (mp4sByBitrate.length >= 1) {
                    console.log(mp4sByBitrate[0].url)                    
                }
                res.status(200).json(data)
            }
        })
    }, CONFIG.PROXY_TIMEOUT /* delay before trying another proxy */);
  })
  
  // http://localhost:3000/tvppl/manifest/http%3A%2F%2Fsdt-thinx3-163t.tvp.pl%2Ftoken%2Fvideo%2Fvod%2F45425590%2F20200727%2F3000251655%2Fef710ca0-1666-4ba5-b746-c47d8e87c5d0%2Fvideo.ism%2Fmanifest
  .get("/tvppl/manifest/:url", (req, res) => {
      const manifest_url = req.params.url
      
      request({
        'url': manifest_url,
        'method': "GET",
    },function (error, response, body) {
        if (!error && response.statusCode == 200) {
            const heights = []
            const lines = response.body.split(/[\r\n]/).filter((line) => line.startsWith("#EXT-X-I-FRAME-STREAM-INF"))
            for (const line of lines) {
                const arr = line.match(/RESOLUTION=\d+x(\d+)/i)
                heights.push(parseInt(arr[1]));
            }
            
            res.status(200).json(heights)
        }
    })
  })

app.use("/", router)


// we will pass our 'app' to 'http' server
http
  .createServer(app)
  .listen(CONFIG.PORT, () =>
    console.log(`polish proxy listening at http://localhost:${CONFIG.PORT}`)
  )

// listen for input
const stdin = process.openStdin();
stdin.addListener("data", function(d) {
    // note:  d is an object, and when converted to a string it will
    // end with a linefeed.  so we (rather crudely) account for that  
    // with toString() and then trim()
    const input = d.toString().trim()
    
    if (input == "help" || input == "h") {
        console.log("\nPolish Proxy\n")
        console.log("Available Commands:")
        console.log("refresh or r - refresh proxy list")
        console.log("priority or p - list proxies by priority")
        console.log("reset - reset proxy priority\n")
    } else if (input == "refresh" || input == "r") {
        refreshProxies();
    } else if (input == "priority" || input == "p") {
        console.log(proxyArray);
    } else if (input == "reset") {
        resetProxies();
    }
  });

console.log(`Type help for list of available commands.`)

