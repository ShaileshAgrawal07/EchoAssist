
const fs = require('fs');
const https = require('https')
const express = require('express');
const app = express();
const socketio = require('socket.io');
app.use(express.static(__dirname))

// $ mkcert create-ca
// $ mkcert create-cert
const key = fs.readFileSync('cert.key');
const cert = fs.readFileSync('cert.crt');

const expressServer = https.createServer({key, cert}, app);
const io = socketio(expressServer,{
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
expressServer.listen(5000);


const offers = [
    
];
const connectedSockets = [
    
]

io.on('connection',(socket)=>{
    const userName = socket.handshake.auth.userName;
    const password = socket.handshake.auth.password;

    if(password !== "x"){
        socket.disconnect(true);
        return;
    }
    connectedSockets.push({
        socketId: socket.id,
        userName
    })

    if(offers.length){
        socket.emit('availableOffers',offers);
    }

    socket.on('newOffer',newOffer=>{
        offers.push({
            offererUserName: userName,
            offer: newOffer,
            offerIceCandidates: [],
            answererUserName: null,
            answer: null,
            answererIceCandidates: []
        })
        socket.broadcast.emit('newOfferAwaiting',offers.slice(-1))
    })

    socket.on('newAnswer',(offerObj,ackFunction)=>{
        console.log(offerObj);
        const socketToAnswer = connectedSockets.find(s=>s.userName === offerObj.offererUserName)
        if(!socketToAnswer){
            console.log("No matching socket")
            return;
        }
        const socketIdToAnswer = socketToAnswer.socketId;
        const offerToUpdate = offers.find(o=>o.offererUserName === offerObj.offererUserName)
        if(!offerToUpdate){
            console.log("No OfferToUpdate")
            return;
        }
        ackFunction(offerToUpdate.offerIceCandidates);
        offerToUpdate.answer = offerObj.answer
        offerToUpdate.answererUserName = userName
        socket.to(socketIdToAnswer).emit('answerResponse',offerToUpdate)
    })

    socket.on('sendIceCandidateToSignalingServer', iceCandidateObj => {
        const { didIOffer, iceUserName, iceCandidate } = iceCandidateObj;
        if (didIOffer) {
            const offerInOffers = offers.find(o => o.offererUserName === iceUserName);
            if (offerInOffers) {
                offerInOffers.offerIceCandidates.push(iceCandidate);
                if (offerInOffers.answererUserName) {
                    const socketToSendTo = connectedSockets.find(s => s.userName === offerInOffers.answererUserName);
                    if (socketToSendTo) {
                        socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer', iceCandidate);
                    }
                }
            }
        } else {
            const offerInOffers = offers.find(o => o.answererUserName === iceUserName);
            const socketToSendTo = connectedSockets.find(s => s.userName === offerInOffers.offererUserName);
            if (socketToSendTo) {
                socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer', iceCandidate);
            }
        }
    });
    socket.on('hangup', ({ userName }) => {
        console.log("${userName} has hung up");
        socket.broadcast.emit('callEnded', { userName });
        const index = offers.findIndex(o => o.offererUserName === userName || o.answererUserName == userName);
         if (index !== -1) {
            offers.splice(index, 1);
            console.log("Offer related to ${userName} removed");
         }
       });
    socket.on('speechTosymbol', (data) => {
        console.log(`Received speech-to-symbol data from ${socket.id}:`, data);
        socket.broadcast.emit('updateSpeechToSymbol',data);
    });
    socket.on('startScreenShare', (data) => {                                                       
        socket.broadcast.emit('receivedMyScreenShareStream', data);
    });
    
    socket.on('stopScreenShare', () => {
        socket.broadcast.emit('MyscreenShareStopped');
    });
})