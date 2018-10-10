//@ts-check
const mapshaper = require('mapshaper');
const fs = require('fs');
const util = require('util');
const request = require('postman-request');

const locais = require("./../../registros/ById.json");

const runMapShaper = util.promisify(mapshaper.runCommands);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const Selector = {
    convert: (obj) => {
        const resp = {
            codigo: obj.id,
            nome: obj.nome
        }
        if (obj.sigla) {
            resp.sigla = obj.sigla;
        }
        return resp;
    },

    getMicrorregiao: (json) => json.microrregiao,
    getMesorregiao: (json) => this.getMicrorregiao().mesorregiao,
    getUF: (json) => this.getMesorregiao().UF,
    getRegiao: (json) => this.getUF().regiao,

    getMunicipioObj: (json) => this.convert(json),
    getMicrorregiaoObj: (json) => this.convert(this.getMicrorregiao(json)),
    getMesorregiaoObj: (json) => this.convert(this.getMesorregiao(json)),
    getUFObj: (json) => this.convert(this.getUF(json)),
    getRegiaoObj: (json) => this.convert(this.getRegiao(json))
}

const simplifications = ["0.3%", "1%", "8%", "15%"];

simplifications.forEach((simplify, idx) => {

    const file = `geojson/rj-municipios-${idx + 1}.json`

    mapshaper.runCommands(`
        -i snap original/*.shp 
        -clean
        -each "
            codigo=CD_GEOCMU, 
            nome=NM_MUNICIP,
            centroidX=this.centroidX, 
            centroidY=this.centroidY, 
            innerPositionX=this.innerX, 
            innerPositionY=this.innerY,
            delete CD_GEOCMU, 
            delete NM_MUNICIP
        " 
        -simplify ${simplify} keep-shapes
        -o ${file} presimplify precision=${Math.pow(10, -4)} format=geojson
        `, function (err, p1, p2, p3, p4) {

            if (err) {
                console.error(err);
            }

            fs.readFile(file, 'utf8', (err, contents) => {
                const json = JSON.parse(contents);
                const update = { type: json.type, features: [] }

                json.features.forEach(obj => {
                    const codigo = obj.properties.codigo;
                    const props = locais[codigo];

                    const centroidX = parseFloat(obj.properties.centroidX.toFixed(4));
                    const centroidY = parseFloat(obj.properties.centroidY.toFixed(4));
                    const innerPositionX = parseFloat(obj.properties.innerPositionX.toFixed(4));
                    const innerPositionY = parseFloat(obj.properties.innerPositionY.toFixed(4));

                    obj.properties = {
                        ...props,
                        centroide: { x: centroidX, y: centroidY },
                        inner: { x: innerPositionX, y: innerPositionY }
                    };

                    update.features.push(Object.assign({}, obj));
                });


                fs.writeFile(file, JSON.stringify(update), 'utf-8', (err) => {
                    if (err) console.error(err);
                    console.log(file + ' saved!');
                });

            });
        }
    );

});

simplifications.forEach((simplify, idx) => {

    const fileJSON = `geojson/rj-microrregioes-${idx + 1}.json`;
    const fileSHP = `shapes/rj-microrregioes-${idx + 1}.shp`

    runMapShaper(
        `
        -i snap original/*.shp 
        -clean
        -each "
            codigo=CD_GEOCMU, 
            nome=NM_MUNICIP,
            centroidX=this.centroidX, 
            centroidY=this.centroidY, 
            innerPositionX=this.innerX, 
            innerPositionY=this.innerY,
            delete CD_GEOCMU, 
            delete NM_MUNICIP
        " 
        -simplify ${simplify} keep-shapes
        -o ${fileJSON} presimplify precision=${Math.pow(10, -4)} format=geojson
    `)
        .then(_ => readFile(fileJSON, 'utf8'))
        .then(contents => {
            const json = JSON.parse(contents);
            const update = { type: json.type, features: [] }

            json.features.forEach(obj => {
                const codigo = obj.properties.codigo;
                const props = locais[codigo];

                obj.properties = {
                    codigo: props.microrregiao.id
                }

                update.features.push(Object.assign({}, obj));
            });

            return writeFile(fileJSON, JSON.stringify(update), 'utf-8');
        })
        .then(_ => {
            return runMapShaper(`
            -i ${fileJSON} 
            -clean
            -dissolve fields=codigo
            -o ${fileSHP} format=shapefile
            `);
        })
        .then(_ => {
            return runMapShaper(
                `
                -i ${fileSHP}
                -clean
                 -each "
                    centroidX=this.centroidX, 
                    centroidY=this.centroidY, 
                    innerPositionX=this.innerX, 
                    innerPositionY=this.innerY
                    delete codigo
                " 
                -o ${fileJSON} format=geojson
            `);
        })
        .then(_ => readFile(fileJSON, 'utf8'))
        .then(contents => {
            const json = JSON.parse(contents);
            const update = { type: json.type, features: [] }

            json.features.forEach(obj => {
                const codigo = obj.properties.codigo;
                const props = locais[codigo];

                const centroidX = parseFloat(obj.properties.centroidX.toFixed(4));
                const centroidY = parseFloat(obj.properties.centroidY.toFixed(4));
                const innerPositionX = parseFloat(obj.properties.innerPositionX.toFixed(4));
                const innerPositionY = parseFloat(obj.properties.innerPositionY.toFixed(4));

                obj.properties = {
                    ...props,
                    centroide: { x: centroidX, y: centroidY },
                    inner: { x: innerPositionX, y: innerPositionY }
                };

                update.features.push(Object.assign({}, obj));
            });

            return writeFile(fileJSON, JSON.stringify(update), 'utf-8');
        })
        .then(_ => console.log(fileJSON + ' saved!'))
        .catch(err => console.error(err));

});


simplifications.forEach((simplify, idx) => {

    const fileJSON = `geojson/rj-mesorregioes-${idx + 1}.json`;
    const fileSHP = `shapes/rj-mesorregioes-${idx + 1}.shp`

    runMapShaper(
        `
        -i snap original/*.shp 
        -clean
        -each "
            codigo=CD_GEOCMU, 
            nome=NM_MUNICIP,
            centroidX=this.centroidX, 
            centroidY=this.centroidY, 
            innerPositionX=this.innerX, 
            innerPositionY=this.innerY,
            delete CD_GEOCMU, 
            delete NM_MUNICIP
        " 
        -simplify ${simplify} keep-shapes
        -o ${fileJSON} presimplify precision=${Math.pow(10, -4)} format=geojson
    `)
        .then(_ => readFile(fileJSON, 'utf8'))
        .then(contents => {
            const json = JSON.parse(contents);
            const update = { type: json.type, features: [] }

            json.features.forEach(obj => {
                const codigo = obj.properties.codigo;
                const props = locais[codigo];

                obj.properties = {
                    codigo: props.mesorregiao.id
                }

                update.features.push(Object.assign({}, obj));
            });

            return writeFile(fileJSON, JSON.stringify(update), 'utf-8');
        })
        .then(_ => {
            return runMapShaper(`
            -i ${fileJSON} 
            -clean
            -dissolve fields=codigo
            -o ${fileSHP} format=shapefile
            `);
        })
        .then(_ => {
            return runMapShaper(
                `
                -i ${fileSHP}
                -clean
                 -each "
                    centroidX=this.centroidX, 
                    centroidY=this.centroidY, 
                    innerPositionX=this.innerX, 
                    innerPositionY=this.innerY
                    delete codigo
                " 
                -o ${fileJSON} format=geojson
            `);
        })
        .then(_ => readFile(fileJSON, 'utf8'))
        .then(contents => {
            const json = JSON.parse(contents);
            const update = { type: json.type, features: [] }

            json.features.forEach(obj => {
                const codigo = obj.properties.codigo;
                const props = locais[codigo];

                const centroidX = parseFloat(obj.properties.centroidX.toFixed(4));
                const centroidY = parseFloat(obj.properties.centroidY.toFixed(4));
                const innerPositionX = parseFloat(obj.properties.innerPositionX.toFixed(4));
                const innerPositionY = parseFloat(obj.properties.innerPositionY.toFixed(4));

                obj.properties = {
                    ...props,
                    centroide: { x: centroidX, y: centroidY },
                    inner: { x: innerPositionX, y: innerPositionY }
                };

                update.features.push(Object.assign({}, obj));
            });

            return writeFile(fileJSON, JSON.stringify(update), 'utf-8');
        })
        .then(_ => console.log(fileJSON + ' saved!'))
        .catch(err => console.error(err));

});

simplifications.forEach((simplify, idx) => {

    const fileJSON = `geojson/rj-uf-${idx + 1}.json`;
    const fileSHP = `shapes/rj-uf-${idx + 1}.shp`

    runMapShaper(
        `
        -i snap original/*.shp 
        -clean
        -each "
            codigo=CD_GEOCMU, 
            nome=NM_MUNICIP,
            centroidX=this.centroidX, 
            centroidY=this.centroidY, 
            innerPositionX=this.innerX, 
            innerPositionY=this.innerY,
            delete CD_GEOCMU, 
            delete NM_MUNICIP
        " 
        -simplify ${simplify} keep-shapes
        -o ${fileJSON} presimplify precision=${Math.pow(10, -4)} format=geojson
    `)
        .then(_ => readFile(fileJSON, 'utf8'))
        .then(contents => {
            const json = JSON.parse(contents);
            const update = { type: json.type, features: [] }

            json.features.forEach(obj => {
                const codigo = obj.properties.codigo;
                const props = locais[codigo];

                obj.properties = {
                    codigo: props.uf.id
                }

                update.features.push(Object.assign({}, obj));
            });

            return writeFile(fileJSON, JSON.stringify(update), 'utf-8');
        })
        .then(_ => {
            return runMapShaper(`
            -i ${fileJSON} 
            -clean
            -dissolve fields=codigo
            -o ${fileSHP} format=shapefile
            `);
        })
        .then(_ => {
            return runMapShaper(
                `
                -i ${fileSHP}
                -clean
                 -each "
                    centroidX=this.centroidX, 
                    centroidY=this.centroidY, 
                    innerPositionX=this.innerX, 
                    innerPositionY=this.innerY
                    delete codigo
                " 
                -o ${fileJSON} format=geojson
            `);
        })
        .then(_ => readFile(fileJSON, 'utf8'))
        .then(contents => {
            const json = JSON.parse(contents);
            const update = { type: json.type, features: [] }

            json.features.forEach(obj => {
                const codigo = obj.properties.codigo;
                const props = locais[codigo];

                const centroidX = parseFloat(obj.properties.centroidX.toFixed(4));
                const centroidY = parseFloat(obj.properties.centroidY.toFixed(4));
                const innerPositionX = parseFloat(obj.properties.innerPositionX.toFixed(4));
                const innerPositionY = parseFloat(obj.properties.innerPositionY.toFixed(4));

                obj.properties = {
                    ...props,
                    centroide: { x: centroidX, y: centroidY },
                    inner: { x: innerPositionX, y: innerPositionY }
                };

                update.features.push(Object.assign({}, obj));
            });

            return writeFile(fileJSON, JSON.stringify(update), 'utf-8');
        })
        .then(_ => console.log(fileJSON + ' saved!'))
        .catch(err => console.error(err));

});

