var qu = require('./u.js');
const uuid = require('uuid');
const WebSocket = require('ws');

const taskq = new qu(1000);
const readyq = new qu(1000);

var temp = [];

const playerq = new qu(1000);   //waiting room

const idmplnm = new Map();
const se2pl = new Map();     // game--{<p1>,<p2>}
const pmse = new Map();         // player--game
const plmexp = new Map();       // player--exp

const plmws = new Map();        //playername-ws


const nofrand = 100;
const lvls = new Array(nofrand*3);

const lvldm = [5*8, 7*8, 9*8];


let c = 0;
for (let a = 0; a < nofrand*lvldm.length; ++a) {

    let al = [];
    [...Array(Math.floor(Math.random() * (10 - 5 - 1) + 5))]
        .map((v) => {
            let vv = Math.floor(Math.random() * (lvldm[c] - 1) + 1);
            while (al.includes(vv))
                vv = Math.floor(Math.random() * (lvldm[c] - 1) + 1);

            al.push(vv);
            return null;
        });
    lvls[a] = al;
    // console.log(al);
    if ((a + 1) % nofrand === 0)
        c += 1;
}

function generate(e) {
    console.log('inside generate ', e);
    let min = nofrand*e;
    let fnd = Math.floor(Math.random()*(min+nofrand - min)+ min);
    console.log('inside generate return indenx', fnd);
    // console.log(lvls[fnd]);
    return lvls[fnd];
}


const ACN = {
    "DISCS": -1,
    "KEYR": 9,
    "INVALID": 0,
    "JOIN": 1,
    "JOINR": 2,
    "DISC": 3,
    "DISCR": 4,
    "SUB": 5,
    "SUBR": 6,
    "NEXT": 7,
    "NEXTR": 8,

    "PLEXP": 30000,
    "SWEXP": 60000
}

Object.freeze(ACN);

const ACND = {
    "FAIL": 0,
    "SUCCESS": 1
}

Object.freeze(ACND);


const wss = new WebSocket.Server({ port: process.env.PORT || 8000 });
// setInterval(sweeper, ACN.SWEXP);
wss.on('connection', (ws) => {
    ////////////////////////////////////
    const id = uuid.v4();
    plmws.set(id,ws);
    ws.send(JSON.stringify({h:id, c:ACN.KEYR, d: 0}));
    /////////////////////////////////////

    ws.on('close', ()=>{});
    
    ws.on('message', (data) => {
        // ws.send("ho!");
        var datah = JSON.parse(data);
        console.log('Received message =>', datah);

        if(reqinvalid(datah) || isnotauthorized(ws,datah))
            return;
        else{
            datah.h = id;
            taskq.add(datah);    
        }

        let len = taskq.csize;

        console.log(taskq.csize);

        while(len-->0){
            console.log('======',len,'=======');
            processTask(taskq.remove());
        }

        readyq.consume((e)=>{
            let wsc = plmws.get(e.h);
            if(wsc!==undefined)
                wsc.send(JSON.stringify(e));            
        })
    });

    console.log('server started');
    console.log('init server ho!')
});
///////////////////////////////////////////////////////



///////////////////////////////////////////////////////

function processTask(task) {
    var readytogo = task;
    console.log(readytogo.h,' incoming\n');

    // let taskarr = [];

    if (readytogo.c === ACN.JOIN) {
        if (isPlaying(readytogo.h)) {
            plmexp.set(readytogo.h, Date.now() + ACN.PLEXP);
            readytogo.c = ACN.INVALID;
            console.log(readytogo.h,'invalid join req\n');
        }
        else {
            if(readytogo.d.length > 10)
                return;

            readytogo.c = ACN.JOINR;
            var opp = findOpp(readytogo.h);

            if (opp === null) {
                console.log(readytogo.h,'added to waiting\n');
                playerq.add(readytogo.h);
                idmplnm.set(readytogo.h,readytogo.d);
                readytogo.d = ACND.FAIL;
            }
            else {
                console.log(readytogo.h,'found opponent\n P1',readytogo.h,'     P2', opp);
                addGameInst(opp, readytogo.h);
                
                let readytogo1 = {};
                readytogo1.h = opp;
                readytogo1.c = ACN.JOINR;
                readytogo1.d = readytogo.d;

                readytogo.d = idmplnm.get(opp);
                idmplnm.delete(opp);

                readyq.add(readytogo1);

                plmexp.set(readytogo.h, Date.now() + ACN.PLEXP);
                plmexp.set(readytogo1.h, Date.now() + ACN.PLEXP);
            }
        }

        readyq.add(readytogo);
    }
    else if (isPlaying(readytogo.h)) {
        plmexp.set(readytogo.h, Date.now() + ACN.PLEXP);

        switch (readytogo.c) {
            case ACN.DISCS: //DISC 1 WAY
                console.log(readytogo.h,'Disconnecting 1 way\n');
                console.log('SERVER------> 1 way disconnected');

                plmexp.delete(readytogo.h);
                se2pl.delete(pmse.get(readytogo.h));
                pmse.delete(readytogo.h);

                readyq.add(readytogo);

                break;

            case ACN.DISC: //DISC 2 WAY
                console.log(readytogo.h,'Disconnecting 2 way\n');
                console.log('SERVER------> 2 way disconnected');

                readytogo.c = ACN.DISCR;
                readytogo.d = ACND.SUCCESS;

                let se = pmse.get(readytogo.h);
                disc(se, readytogo.h, readyq);

                break;

            case ACN.SUB: //SUBMIT
                console.log('SERVER------> submitted result');

                readytogo.c = ACN.NEXTR;
                let sse = pmse.get(readytogo.h);
                submit(sse, readytogo.h);

                let readytogo2 = {};
                readytogo2.h = theotherone(sse,readytogo.h);
                readytogo2.c = ACN.SUBR;
                readytogo2.d = readytogo.d;

                console.log(readytogo2.h, 'submitted rem:', readytogo.d);

                readyq.add(readytogo2);
                break;

            case ACN.NEXT: //NEXT 2 WAY
                //next sw
                console.log('SERVER------> NEXT lvl', readytogo.d);

                readytogo.c = ACN.NEXTR;
                let sses = pmse.get(readytogo.h);
                console.log('NEXT from ', readytogo.h,'     game    ',sses);
                if (!submitted(sses , readytogo.h))
                    readytogo.d = ACND.FAIL;
                else{
                    readytogo.c = ACN.NEXTR;

                    console.log('herheerehehrehrher');
                    nextit(sses, readytogo.h);
                    let resh = twonext(sses);
                    let serie = null;

                    if (resh === true) {
                        serie = generate(readytogo.d);
                        console.log('twonext confirmed', serie);
                        var opp = theotherone(sses, readytogo.h);
                        console.log(serie);
                        readytogo.d = serie;

                        let readytogo2 = {h:opp, c:ACN.NEXTR, d: serie};

                        console.log('pushing two series');
                        
                        readyq.add(readytogo2);
                        readyq.add(readytogo);
                    }

                }

                break;

            default:
                console.log('SERVER------> INVALID CLIENT REQUEST');
                readytogo.c = ACN.INVALID;
                break;
        }
    }
    else
        console.log(readytogo.h,' last else\n');

    // return taskarr;
}
// 1j 2res 3disc 4res 5sub 6res 7puzzleme 8res 

function reqinvalid(e) {
    if(!e.hasOwnProperty('h') || !e.hasOwnProperty('c') || !e.hasOwnProperty('d'))
        return true;
    else if(e['h'] === null || e['h'] === undefined)
        return true;
    else
        return false;
}

function isnotauthorized(ws, e) {
    return plmws.get(e['h']) !== ws;
}

function isPlaying(pl) {
    return pmse.has(pl);
}

function findOpp() {
    if (playerq.csize === 0) {
        return null;
    }
    else{
        console.log('waiting players list\n==============\n', playerq.spread(),'\nsize:::',playerq.csize);
        return playerq.remove();
    }
}

function addGameInst(pl1, pl2) {
    let m2 = new Map();

    m2.set(pl1,
        {
            id: pl1,
            exp: 0,
            rem: -1,
            sub: true,
            next: false
        });

    m2.set(pl2,
        {
            id: pl2,
            exp: 0,
            rem: -1,
            sub: true,
            next: false
        });

    //player expiry map
    let exp = Date.now();
    plmexp.set(pl1, exp);
    plmexp.set(pl2, exp);

    //game map
    se2pl.set(pl1, m2);
    // console.log(m2);
    //player game map
    pmse.set(pl1, pl1);
    pmse.set(pl2, pl1);
}

function submitted(game, player) {
    console.log('is submitted', se2pl.get(game).get(player));
    return se2pl.get(game).get(player).sub;
}

function resetsub(game) {
    let g = se2pl.get(game);
    let ab = [...g.keys()];

    let res = false;
    g.get(ab[0]).sub = false;
    g.get(ab[1]).sub = false;

}

function twonext(game) {
    let g = se2pl.get(game);
    let ab = [...g.keys()];
    
    let res = false;

    console.log('inside twonext', res);
    if (g.get(ab[0]).next === true && g.get(ab[1]).next === true) {
        res = true;

        console.log('middle inside twonext', res);
        g.get(ab[0]).next = false;
        g.get(ab[1]).next = false;

        g.get(ab[0]).sub = false;
        g.get(ab[1]).sub = false;
    }

    console.log('end inside twonext', res);
    return res;
}

function nextit(game, player) {
    let p = se2pl.get(game).get(player);
    p.next = true;
    console.log('nextit', se2pl.get(game).get(player));
}

function disc(game, self, taskarr) {
    pmse.delete(self);
    let p2 = theotherone(game, self);
    pmse.delete(p2);

    plmexp.delete(self);
    plmexp.delete(p2);
    plmws.delete(self);

    // taskarr.push(readyq, { h: p2, c: ACN.DISCS });
    taskarr.add({ h: p2, c: ACN.DISCS, d:0 });

    return 1;
}

function submit(game, pl) {
    se2pl.get(game).get(pl).sub = true;

}

function sweeper() {
    console.log('sweeping service');
    console.log('tasks\n=====\n',...taskq.spread());

    if (plmexp.size === 0)
        return;

    let noww = Date.now();

    let itr = plmexp.entries();
    let e = itr.next().value;
    console.log('inside entries');
    while (e != null) {
        console.log(e[0],'->',e[1]);
        if (e[1] < noww)
            taskq.add({ h: e[0], c: ACN.DISCS });

        e = itr.next().value;
    }

    console.log('outside entries');

    console.log(...taskq.spread());

    console.log('==========================\nDELETE');

    let len = taskq.csize;
    console.log(taskq.csize);

    while(len-->0){
        console.log('======',len,'=======');
        processTask(taskq.remove());
    }

    readyq.consume((e)=>{
        let wsc = plmws.get(e.h);
        if(wsc!==undefined)
            wsc.send(JSON.stringify(e));            
    })

    console.log('sweeper service end\n');
}

function theotherone(se,self){
    console.log('find otherone of player', self,' in game',se);
    let plm = se2pl.get(se);
    console.log('map object', plm);
    let key2 =[...plm.keys()];

    if(key2[0] === self)
        return key2[1];
    else
        return key2[0];
}


/////////////////////////////////////////////////////////////////////////////