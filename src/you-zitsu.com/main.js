const request = require('async-request');
const jsdom = require("jsdom");
const fs = require('fs');
const { JSDOM } = jsdom;

async function main() {
    const host = 'http://you-zitsu.com';
    let response = await request('http://you-zitsu.com/character/');
    const dom = new JSDOM(response.body);

    const dataPath = 'data.json';
    let data = (() => {
        if (fs.existsSync(dataPath)) {
            return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        } else {
            return {
                endpoint: 'http://you-zitsu.com',
                characters: {}
            };
        }
    })();
    dom.window.document.querySelectorAll('.chara-list .chara-nav').forEach(z => {
        let charaId = z.hash;
        let charaData = dom.window.document.querySelector(charaId);

        let imageHeader = z.querySelector('img').src;
        let st = imageHeader.startsWith(host);
        let characterName = charaData.querySelector('.name').textContent;
        let imageCharacter = charaData.querySelector('.vis img').src;
        let propertyClass = charaData.querySelector('.class').textContent;
        let cvName = charaData.querySelector('.cv').textContent.replace('CV：', '');
        let description = charaData.querySelector('div.text').textContent;
        let propertiesMap = {};
        charaData.querySelector('.bo').textContent.split('\n').forEach(x => {
            let t = x.split('：', 2);
            propertiesMap[t[0]] = t[1];
        });

        let character = data.characters[characterName];
        if (character === undefined) {
            data.characters[characterName] = character = {
                images: {},
                properties: {},
                propertiesMap: {}
            };
        }
        Object.assign(character, {
            name: characterName,
            cv: cvName,
            description: description,
            propertiesMap: propertiesMap
        });
        Object.assign(character.images, {
            header: imageHeader,
            character: imageCharacter
        });
        Object.assign(character.properties, {
            class: propertyClass
        });
        Object.assign(character.propertiesMap, propertiesMap);
    });

    (function () { // save data
        let fd = fs.openSync('data.json', 'w');
        fs.writeSync(fd, JSON.stringify(data, null, 4));
    })();

    const redirectionPath = 'redirection.json';
    let redirection = (() => {
        if (fs.existsSync(redirectionPath)) {
            return JSON.parse(fs.readFileSync(redirectionPath, 'utf8'));
        } else {
            return {};
        }
    })();

    Object.keys(data.characters).forEach(z => {
        if (!(z in redirection)) {
            redirection[z] = {
                from: []
            };
        }
    });

    (function () { // save data
        //let fd = fs.openSync(redirectionPath, 'w');
        //fs.writeSync(fd, JSON.stringify(redirection, null, 4));
    })();
}

(async function() {
    try {
        await main()
    } catch (error) {
        console.error(error);
    }
})();
