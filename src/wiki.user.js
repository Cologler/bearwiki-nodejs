// ==UserScript==
// @name               New Userscript
// @name:zh-CN         New Userscript
// @namespace          https://github.com/cologler/
// @version            0.1
// @description        try to take over the world!
// @description:zh-CN  try to take over the world!
// @author             cologler
// @match              http://*/*
// @match              https://bangumi.bilibili.com/anime/*
// @connect            .githubusercontent.com
// @connect            .github.com
// @grant              GM_getResourceText
// @grant              GM_xmlhttpRequest
// @grant              GM_addStyle
// @grant              unsafeWindow
// @require            https://cdn.jsdelivr.net/jquery/3.2.1/jquery.min.js
// @require            https://greasyfork.org/scripts/32209-stringsearchermap/code/StringSearcherMap.js
// @resource           siteMap    https://github.com/Cologler/bearwiki-nodejs/raw/master/src/siteMap.json
// ==/UserScript==

// just let type script work.
(function() { function require(){}; require("greasemonkey"); })();

(function() {
    'use strict';

    if (unsafeWindow !== unsafeWindow.top) {
        return;
    }

    const endpoint = 'https://github.com/Cologler/bearwiki-nodejs/raw/master/src';
    const languages = [navigator.language.toLowerCase()];
    languages.push(languages[0].split('-')[0]);

    function getProperty(source, key) {
        for (let i = 0; i < languages.length; i++) {
            let val = source[key + ':' + languages[i]];
            if (val !== undefined) {
                return val;
            }
        }
        return source[key];
    }

    let siteData = null;
    let siteRedirection = null;
    let redirectionMap = null;
    let observer = null;

    class SiteContext {
        constructor(site) {
            this._site = site;
        }

        listenPage() {
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

        onSiteDataUpdate(namespace, data) {
            siteData = data;
            if (siteRedirection) {
                this.listenPage();
            }
        }

        onSiteRedirectionUpdate(namespace, data) {
            siteRedirection = data;
            redirectionMap = new StringSearcherMap();
            Object.keys(data).forEach(key => {
                redirectionMap.add(key, key);
                data[key].from.forEach(z => redirectionMap.add(z, key));
            });
            redirectionMap.sort();
            if (siteData) {
                this.listenPage();
            }
        }

        loadSite() {
            let self = this;
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${endpoint}/${self._site.namespace}/data.json`,
                onreadystatechange: e => {
                    if (e.readyState === 4) {
                        self.onSiteDataUpdate(self._site.namespace, JSON.parse(e.responseText));
                    }
                }
            });
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${endpoint}/${self._site.namespace}/redirection.json`,
                onreadystatechange: e => {
                    if (e.readyState === 4) {
                        self.onSiteRedirectionUpdate(self._site.namespace, JSON.parse(e.responseText));
                    }
                }
            });
        }
    }

    class CharacterBox {
        static get CLASS_NAME() { return 'ch-el'; }

        constructor() {
            this._container = null;
            this._header = null;
            this._name = null;
            this._desc = null;
            this._prop = null;
            this._hover = false;
            this._charaData = null;
        }

        init() {
            if (this._container) {
                return;
            }
            let self = this;
            let root = document.createElement('div');
            root.onmouseover = () => self._hover = true;
            root.onmouseout  = () => self.unhover();
            this._container = root;
            this._container.id = 'cb-root';
            this._container.classList.add(CharacterBox.CLASS_NAME);
            this._container.innerHTML = `
            <div class="ch-el cb-col">
              <img id="cb-ch-header" class="ch-el" async></img>
              <p id="cb-ch-name" class="ch-el"></p>
            </div>
            <div class="ch-el cb-col">
              <p id="cb-ch-desc" class="ch-el"></p>
              <div id="cb-ch-prop" class="ch-el"></div>
            </div>
            `;
            this._header = this._container.querySelector('#cb-ch-header');
            this._name = this._container.querySelector('#cb-ch-name');
            this._desc = this._container.querySelector('#cb-ch-desc');
            this._prop = this._container.querySelector('#cb-ch-prop');
            this._container.style.display = 'none';
            console.assert(null !== this._header);
            console.assert(null !== this._name);
            console.assert(null !== this._desc);
            console.assert(null !== this._prop);

            GM_addStyle(`
                #cb-root {
                    position: fixed;
                    z-index: 999999;
                    top: 45%;
                    left: 10%;
                    box-shadow: 0 2px 30px 0 rgba(0,0,0,0.3), 0 3px 1px -2px rgba(0,0,0,0.12), 0 1px 5px 0 rgba(0,0,0,0.2);
                    padding: 8px;
                    background: white;
                }
                .cb-col {
                    display: inline-block;
                    vertical-align: top;
                }
                #cb-ch-header {
                }
                #cb-ch-name {
                    text-align: center;
                    font-size: 15px;
                    margin-top: 4px;
                }
                #cb-ch-desc {
                    max-width: 320px;
                    margin: 2px 0px 2px 8px;
                }
                #cb-ch-prop {
                    margin: 6px 0px 2px 20px;
                }
            `);

            document.body.appendChild(this._container);
        }

        hover(node) {
            this._hover = true;
            this.init();
            let offset =  node.getBoundingClientRect();
            let top = offset.top + $(node).height() + 55;
            let left = offset.left + 50;
            this._container.style.top = top + 'px';
            this._container.style.left = left + 'px';
            let self = this;

            let charaData = siteData.characters[node.wikidata.data];
            if (this._charaData !== charaData) {
                this._charaData = charaData;
                this._header.src = '';
                this._header.src = siteData.endpoint + charaData.images.header;
                this._name.innerText = getProperty(charaData, 'name');
                this._desc.innerText = getProperty(charaData, 'description');

                let propKeys = Object.keys(charaData.propertiesMap);
                if (propKeys.length < this._prop.childNodes.length) {
                    new Array(this._prop.childNodes.length - propKeys.length).fill().forEach(() => {
                        this._prop.removeChild(this._prop.childNodes[0]);
                    });
                } else if (propKeys.length > this._prop.childNodes.length) {
                    new Array(propKeys.length - this._prop.childNodes.length).fill().forEach(() => {
                        let elr = document.createElement('div');
                        elr.classList.add(CharacterBox.CLASS_NAME);

                        let elk = document.createElement('span');
                        elk.classList.add(CharacterBox.CLASS_NAME);
                        elr.appendChild(elk);

                        let elv = document.createElement('span');
                        elv.classList.add(CharacterBox.CLASS_NAME);
                        elr.appendChild(elv);

                        this._prop.appendChild(elr);

                        if (siteData.configuration) {
                            let color = siteData.configuration['propertiesMap-color'];
                            if (color) {
                                elk.style.color = color;
                                elv.style.color = color;
                            }
                        }
                    });
                }
                console.assert(propKeys.length == this._prop.childNodes.length);
                for (let i = 0; i < propKeys.length; i++) {
                    let val = charaData.propertiesMap[propKeys[i]];
                    this._prop.childNodes[i].childNodes[0].innerText = propKeys[i] + ' : ';
                    this._prop.childNodes[i].childNodes[1].innerText = val;
                }
            }
            this._container.style.display = 'block';
        }

        unhover() {
            this._hover = false;
            let self = this;

            if (this._container) {
                setTimeout(() => {
                    if (this._container && !self._hover) {
                        this._container.style.display = 'none';
                    }
                }, 1300);
            }
        }
    }
    let characterBox = new CharacterBox();

    function onNode(node) {
        if (node.classList && node.classList.contains(CharacterBox.CLASS_NAME)) {
            return;
        }

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
                        nextNode.wikidata = z;
                        nextNode.onmouseover = () => characterBox.hover(nextNode);
                        nextNode.onmouseout  = () => characterBox.unhover();
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

    class Site {
        constructor(data) {
            this._namespace = data.namespace;
            this._name = getProperty(data, 'name');
            this._data = data;

            let self = this;
            Object.defineProperty(this, 'namespace', {
                get: () => self._namespace
            });
            Object.defineProperty(this, 'name', {
                get: () => self._name
            });
        }

        match() {
            function matchRule(rule, value) {
                switch (rule.mode) {
                    case 'startswith':
                        return value.startsWith(rule.value);
                    case 'equals':
                        return value === rule.value;
                    case 'regex':
                        return new RegExp(rule.value).test(value);
                    default:
                        console.error('unknown mode:' + rule.mode);
                        return false;
                }
            }

            if (/bilibili\.com/.test(location.host)) {
                let rules = this._data.siteMap['bilibili'];
                let url = location.href;
                if (rules) {
                    return rules.some(z => matchRule(z, url));
                }
            } else {

            }

            return false;
        }
    }

    function onPageRefresh() {
        let siteMap = JSON.parse(GM_getResourceText('siteMap'));
        Object.keys(siteMap).forEach(z => {
            siteMap[z] = new Site(siteMap[z]);
        });

        let site = (() => {
            let sites = Object.values(siteMap);
            for (let i = 0; i < sites.length; i++) {
                let s = sites[i];
                if (s.match()) {
                    return s;
                }
            }
            return null;
        });

        if (site) {
            let siteContext = new SiteContext(site);
            siteContext.loadSite();
        }
    }

    onPageRefresh();
})();