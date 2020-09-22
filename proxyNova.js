/**
 * Get a list of proxies from proxy nova
 */

const https = require('https')
const cherio = require('cherio')

const proxyNova = {}

/**
 * @param {String} url - proxy nova website, ex. https://www.proxynova.com/proxy-server-list/country-pl/
 * @return {Promise[]} - [{"ip": "88.199.21.76", "port": "80"}, ...]
 */
function getProxyNovaList(url) {
    return new Promise(function(resolve, reject) {
        let newProxyArray = [];
        
        // https://www.proxynova.com/proxy-server-list/country-pl/
        https.get(url, (resp) => {
            let data = '';

            // A chunk of data has been recieved.
            resp.on('data', (chunk) => {
                data += chunk;
            });

            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                const $ = cherio.load(data)
                const trs = $('#tbl_proxy_list tbody tr')
                
                trs.each(function (i, e) {
                    const html = $(this).html()
                    
                    const ip_el = $(e).find('td abbr script')
                    const port_el = $(e).find('td')
                    
                    const docWritePattern = new RegExp(/^document.write\('(.*)'\);$/)
                    
                    /*
                        [
                            '8080',         // port
                            '4538',         // proxy speed in milliseconds
                            'ms',
                            '8%',           // proxy uptime %
                            '(47)',
                            'Poland',       // country
                            '-',
                            'Jaworzno',     // city
                            'Transparent'   // anonymity
                        ] 
                    */
                    const port_data = $(port_el).next().text().replace(/\s+/g, " ").trim().split(' ')
                    
                    const proxy = {
                        ip: '',
                        port: port_data[0]
                    }
                    
                    const ip_el_html = $(ip_el).html()
                    if (ip_el_html && ip_el_html.match(docWritePattern)) {
                        proxy.ip = ip_el_html.match(docWritePattern)[1]
                    }
                    
                    if (proxy.ip !== '' && proxy.port !== '') {
                        newProxyArray.push(proxy)
                    }
                });
                
                // resolve new list of proxies
                resolve(newProxyArray)
            });

        }).on("error", (err) => {
            console.log("Error: " + err.message);
            reject(err);
        });
    });
}

proxyNova.getProxyNovaList = getProxyNovaList

module.exports = proxyNova 
