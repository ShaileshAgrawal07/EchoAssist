const userName = "Deciphers - "+Math.floor(Math.random() * 100000)
const password = "x";
document.querySelector('#user-name').innerHTML = userName;


const socket = io.connect('https://localhost:5000/',{
    // const socket = io.connect('https://localhost:8181/',{
        auth: {
            userName,password
        }
    })

const localVideoEl = document.querySelector('#local-video');
const remoteVideoEl = document.querySelector('#remote-video');
const screenShareVideo = document.getElementById('screen-share-video');
const stopScreenShareBtn = document.getElementById('stopScreenShare');
const startScreenShareBtn = document.getElementById('startScreenShare');

let localStream; 
let remoteStream; 
let peerConnection; 
let didIOffer = false;

let peerConfiguration = {
    iceServers:[
        {
            urls:[
              'stun:stun.l.google.com:19302',
              'stun:stun1.l.google.com:19302',
            ]
        }
    ]
}

//when a client initiates a call
const call = async (e) =>{
    try{
    await fetchUserMedia();
    //peerConnection is all set with our STUN servers sent over
    await createPeerConnection();
    //create offer time!
        console.log("Creating offer...")
        const offer = await peerConnection.createOffer();
        console.log(offer);
        peerConnection.setLocalDescription(offer);
        didIOffer = true;
        socket.emit('newOffer',offer);
        
        updateUIOnCallStart();
    }catch(err){
        console.log(err)
    }

};

const answerOffer = async(offerObj)=>{
    await fetchUserMedia()
    await createPeerConnection(offerObj);
    const answer = await peerConnection.createAnswer({}); 
    await peerConnection.setLocalDescription(answer); 
    console.log(offerObj)
    console.log(answer)
    offerObj.answer = answer 
    const offerIceCandidates = await socket.emitWithAck('newAnswer',offerObj)
    offerIceCandidates.forEach(c=>{
        peerConnection.addIceCandidate(c);
        console.log("======Added Ice Candidate======")
    })
    console.log(offerIceCandidates)
}

const addAnswer = async(offerObj)=>{
    await peerConnection.setRemoteDescription(offerObj.answer)
    // console.log(peerConnection.signalingState)
}

const fetchUserMedia = ()=>{
    return new Promise(async(resolve, reject)=>{
        try{
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });

            localVideoEl.srcObject = stream;
            localStream = stream;    
            resolve();    
        }catch(err){
            console.log(err);
            reject()
        }
    })
}

const createPeerConnection = (offerObj)=>{
    return new Promise(async(resolve, reject)=>{
        //RTCPeerConnection is the thing that creates the connection
        peerConnection = await new RTCPeerConnection(peerConfiguration)
        remoteStream = new MediaStream()
        remoteVideoEl.srcObject = remoteStream;


        localStream.getTracks().forEach(track=>{
            peerConnection.addTrack(track,localStream);
        })

        peerConnection.addEventListener("signalingstatechange", (event) => {
            console.log(event);
            console.log(peerConnection.signalingState)
        });

        peerConnection.addEventListener('icecandidate',e=>{
            console.log('........Ice candidate found!......')
            console.log(e)
            if(e.candidate){
                socket.emit('sendIceCandidateToSignalingServer',{
                    iceCandidate: e.candidate,
                    iceUserName: userName,
                    didIOffer,
                })    
            }
        })
        
        peerConnection.addEventListener('track',e=>{
            console.log("Got a track from the other peer!! How excting")
            console.log(e)
            e.streams[0].getTracks().forEach(track=>{
                remoteStream.addTrack(track,remoteStream);
                console.log("Here's an exciting moment... fingers cross")
            })
        })

        if(offerObj){
            await peerConnection.setRemoteDescription(offerObj.offer)
            // console.log(peerConnection.signalingState) //should be have-remote-offer, because client2 has setRemoteDesc on the offer
        }
        resolve();
    })
}

const addNewIceCandidate = iceCandidate=>{
    peerConnection.addIceCandidate(iceCandidate)
    console.log("======Added Ice Candidate======")
}

const resetUI = () => {
    document.getElementById('call').disabled = false;
    document.getElementById('hangup').disabled = true;
    startScreenShareBtn.disabled = false;
    stopScreenShareBtn.disabled = true;

    localVideoEl.srcObject = null;
    remoteVideoEl.srcObject = null;
    screenShareVideo.srcObject = null;
};

const hangupCall = () => {
    console.log("Hangup button clicked");

    // Stop the screen share if it's active
    stopScreenShare();  // This ensures screen sharing stops

    // Close the peer connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
        console.log("PeerConnection closed");
    }

    // Stop local media tracks
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        console.log("Local stream tracks stopped");
    }

    // Stop remote media tracks
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
        console.log("Remote stream tracks stopped");
    }

    // Clear video elements
    localVideoEl.srcObject = null;
    remoteVideoEl.srcObject = null;

    // Notify the server
    socket.emit('hangup', { userName });

    resetUI();
};


function stopScreenShare() {
    const stream = screenShareVideo.srcObject;
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        screenShareVideo.srcObject = null;
        console.log('Screen sharing stopped');
    }

    // Replace the video track with the local stream's video track
    const videoTrack = localStream.getVideoTracks()[0];
    const videoSender = peerConnection.getSenders().find(sender => sender.track.kind === 'video');
    if (videoSender) {
        videoSender.replaceTrack(videoTrack);
    }

    // Emit an event to notify others that the screen sharing has stopped
    socket.emit('stopScreenShare');

    // Update UI
    stopScreenShareBtn.disabled = true;
    startScreenShareBtn.disabled = false;
}

document.querySelector('#call').addEventListener('click',call)
// Add event listener for the hang-up button
document.getElementById('hangup').addEventListener('click', hangupCall);
document.getElementById('hangup').disabled = true;

const updateUIOnCallStart = () => {
    document.getElementById('call').disabled = true;
    document.getElementById('hangup').disabled = false;
};


socket.on('callEnded', (data) => {
    console.log("${data.userName} has ended the call");
    resetUI();
});

// Function to start screen sharing
async function startScreenShare() {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true // Include audio if you want to share audio as well
        });

        const videoSender = peerConnection.getSenders().find(sender => sender.track.kind === 'video');
        if (videoSender) {
            videoSender.replaceTrack(screenStream.getVideoTracks()[0]);
        }

        // Notify other users that this user is sharing their screen
        socket.emit('startScreenShare', { streamId: screenStream.id });
        screenShareVideo.srcObject = screenStream;
        screenStream.getVideoTracks()[0].onended = stopScreenShare;

        // Update UI
        stopScreenShareBtn.disabled = false;
        startScreenShareBtn.disabled = true;

    } catch (error) {
        console.error("Error starting screen share:", error);
    }
}

// Function to stop screen sharing
function stopScreenShare() {
    const stream = screenShareVideo.srcObject;
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
        screenShareVideo.srcObject = null;

        const videoTrack = localStream.getVideoTracks()[0];
        const videoSender = peerConnection.getSenders().find(sender => sender.track.kind === 'video');
        if (videoSender) {
            videoSender.replaceTrack(videoTrack);
        }
        // Emit an event to notify others that the screen sharing has stopped
        socket.emit('stopScreenShare');

    // Enable/Disable the buttons accordingly
    stopScreenShareBtn.disabled = true;
    startScreenShareBtn.disabled = false;
    // Update UI
}

// Event listeners for the screen share buttons
document.getElementById('startScreenShare').addEventListener('click', startScreenShare);
document.getElementById('stopScreenShare').addEventListener('click', stopScreenShare);
document.querySelector('#call').addEventListener('click',call)

socket.on('receivedScreenShareStream', (data) => {
    console.log('Received screen share stream');
    screenShareVideo.srcObject = data.streamId;
});

socket.on('screenShareStopped', () => {
    console.log('Screen sharing stopped by other user');
    screenShareVideo.srcObject = null;
});
