// ==UserScript==
// @name         vod.tvp.pl proxy
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  access vod.tvp.pl anywhere!
// @author       You
// @include      https://vod.tvp.pl/video/*
// @require      https://github.com/plohoj/userscript-requirejs/releases/download/0.0.1/userscript-require.min.js
// @resource     requirejs   https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js
// @resource     ready       https://unpkg.com/@ryanmorr/ready/dist/ready.umd.js
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// @grant        GM_addStyle
// ==/UserScript==

/* global require */

'use strict';

(function() {
    window.tvpProxy = Object.freeze({
       TVPlayer: '#JS-TVPlayer2-Wrapper',
       API_TOKENIZER: (objectId) => `http://www.tvp.pl/shared/cdn/tokenizer_v2.php?object_id=${objectId}`,
       PROXY_URL: (url) => `http://localhost:3000/pl/${encodeURIComponent(url)}`,
       PROXY_API_TOKENIZER: (objectId) => `http://localhost:3000/tvppl/tokenizer/${objectId}`,
    });
})();

require(['ready'], (ready) => {
    const tvpProxy = window.tvpProxy;

    ready(tvpProxy.TVPlayer, (tvplayer) => {
        // fix video css
        const fixVideoCSS = `
/* hide the country blocked */
.region-show {
  display:none !important;
}
/* fit video */
video {
  height: 100%;
  width: 100%;
}
`
        GM_addStyle(fixVideoCSS)

        // get video tokenizer id
        const videoId = tvplayer.dataset.videoId
        console.log("video tokenizer id = " + videoId)

        // proxy the video id request through poland
        const apiProxyUrl = tvpProxy.PROXY_API_TOKENIZER(videoId)
        console.log("proxied tokenizer = " + apiProxyUrl)

        // we need cross domain requests for this
        GM_xmlhttpRequest({
            method: 'GET',
            url: apiProxyUrl,
            onload: function (responseDetails) {
                const respJson = JSON.parse(responseDetails.responseText)
                // get highest quality
                const video_url = respJson.formats[0].url
                // try a lower quality
                //const video_url = respJson.formats[4 % respJson.formats.length].url // 4 % respJson.formats.length

                // create video player
                const vid = document.createElement("video")
                vid.setAttribute("id", "player")
                vid.setAttribute("controls", "controls")

                // append video source
                const source = document.createElement("source")
                source.src = video_url
                source.type = "video/mp4"
                vid.appendChild(source)

                // append video player to the DOM
                tvplayer.appendChild(vid);
            }
        });
    });
});
