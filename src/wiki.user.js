// ==UserScript==
// @name               New Userscript
// @name:zh-CN         New Userscript
// @namespace          https://github.com/cologler/
// @version            0.1
// @description        try to take over the world!
// @description:zh-CN  try to take over the world!
// @author             cologler
// @match              http://*/*
// @match              https://*/*
// @connect            .githubusercontent.com
// @connect            .github.com
// @grant              GM_getResourceText
// @grant              GM_xmlhttpRequest
// @resource           siteMap    https://github.com/Cologler/bearwiki-nodejs/raw/master/src/siteMap.json
// ==/UserScript==

// just let type script work.
(function() { function require(){}; require("greasemonkey"); })();

(function() {
    'use strict';

    const endpoint = 'https://github.com/Cologler/bearwiki-nodejs/raw/master/src';

    const languages = [navigator.language.toLowerCase()];
    languages.push(languages[0].split('-')[0]);

    class StringSearcherMap {
        constructor(table = null) {
            let data = {};
            let minKey = -1;

            this.add = function(key, value) {
                if (typeof key !== 'string') {
                    throw 'key must be string';
                }
                if (key) {
                    let ch = key[0];
                    let ls = data[ch];
                    if (ls === undefined) {
                        data[ch] = ls = [];
                    }
                    let isExists = false;
                    for (let i = 0; i < ls.length; i++) {
                        let entry = ls[i];
                        if (entry.key == key) {
                            entry.value = value;
                            isExists = true;
                            break;
                        }
                    }
                    if (!isExists) {
                        ls.push({
                            key: key,
                            value: value
                        });
                    }
                    minKey = minKey == -1 ? key.length : Math.min(minKey, key.length);
                }
            };

            this.remove = function(key) {
                throw 'not impl remove method.';
            }

            this.match  = function(str) {
                let results = [];
                if (str && minKey !== -1) {
                    let lastStart = 0;
                    let len = str.length - minKey + 1;
                    for (let i = 0; i < len; i++) {
                        let ch = str[i];
                        let ls = data[ch];
                        if (ls) {
                            for (let j = 0; j < ls.length; j ++) {
                                let item = ls[j];
                                if (str.startsWith(item.key, i)) {
                                    if (lastStart < i) {
                                        results.push({
                                            type: 0,
                                            text: str.substr(lastStart, i - lastStart)
                                        });
                                    }
                                    results.push({
                                        type: 1,
                                        text: item.key,
                                        data: item.value
                                    });
                                    i += item.key.length;
                                    lastStart = i;
                                    i--;
                                    break;
                                }
                            }
                        }
                    }
                    if (lastStart < str.length) {
                        results.push({
                            type: 0,
                            text: str.substr(lastStart, str.length - lastStart)
                        });
                    }
                } else {
                    results.push({
                        type: 0,
                        text: str || ''
                    });
                }
                return results;
            };

            if (table) {
                let self = this;
                Object.keys(table).forEach(key => {
                    self.add(key, table[key]);
                });
            }
        }
    }

    class Site {
        constructor(data) {
            this._namespace = data.namespace;
            this._name = data['name:' + languages[0]] ||
                         data['name:' + languages[1]] ||
                         data.name;
            let self = this;
            Object.defineProperty(this, 'namespace', {
                get: () => self._namespace
            });
            Object.defineProperty(this, 'name', {
                get: () => self._name
            })
        }
    }

    let siteMap = JSON.parse(GM_getResourceText('siteMap'));
    Object.keys(siteMap).forEach(z => {
        siteMap[z] = new Site(siteMap[z]);
    });

    let site = siteMap['you-zitsu.com'];
    let siteData = null;
    let siteRedirection = null;
    let redirectionMap = null;

    function onNode(node) {
        if (node.childNodes) {
            node.childNodes.forEach(onNode);
        }

        if (node.nodeType === Node.TEXT_NODE) {
            node.wikidata = redirectionMap.match(node.textContent);
            if (node.wikidata.length > 1) {
                let parent = node.parentNode;
                let replacement = document.createElement('span');
                node.wikidata.forEach(z => {
                    let nextNode = null;
                    if (z.type === 0) {
                        nextNode = document.createTextNode(z.text);
                    } else {
                        nextNode = document.createElement('span');
                        nextNode.innerText = z.text;
                        nextNode.style.color = 'red';
                        nextNode.onmouseover = () => {
                            console.log('hover');
                        };
                        nextNode.onmouseout = () => {
                            console.log('unhover');
                        };
                    }
                    replacement.appendChild(nextNode);
                });
                replacement.wikidata = node.wikidata;
                parent.replaceChild(replacement, node);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            switch (node.tagName.toLowerCase()) {
                case 'p':
                    break;
            }
        }
    }

    function onNodeRoot(node) {
        if (!node) {
            return;
        }
        onNode(node);
    }

    let observer = null;
    function listenPage() {
        console.log('listening');
        if (observer) {
            observer.disconnect();
        }
        observer = new MutationObserver(mrs => {
            mrs.forEach(mr => {
                switch (mr.type) {
                    case 'childList':
                        mr.addedNodes.forEach(onNodeRoot);
                        break;

                    case 'attributes':
                        break;

                    case 'characterData':
                        break;

                    default:
                        console.log(mr.type);
                        break;
                }
            });
        });
        observer.observe(document, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true
        });
        onNodeRoot(document);
    }

    function onSiteDataUpdate(namespace, data) {
        siteData = data;
        if (siteRedirection) {
            listenPage();
        }
    }

    function onSiteRedirectionUpdate(namespace, data) {
        siteRedirection = data;
        redirectionMap = new StringSearcherMap();
        Object.keys(data).forEach(key => {
            data[key].from.forEach(z => redirectionMap.add(z, key));
        });
        if (siteData) {
            listenPage();
        }
    }

    function loadSite() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `${endpoint}/${site.namespace}/data.json`,
            onreadystatechange: e => {
                if (e.readyState === 4) {
                    onSiteDataUpdate(site.namespace, JSON.parse(e.responseText));
                }
            }
        });
        GM_xmlhttpRequest({
            method: 'GET',
            url: `${endpoint}/${site.namespace}/redirection.json`,
            onreadystatechange: e => {
                if (e.readyState === 4) {
                    onSiteRedirectionUpdate(site.namespace, JSON.parse(e.responseText));
                }
            }
        });
    }

    loadSite();
})();