
//on connection get all available offers and call createOfferEls
socket.on('availableOffers',offers=>{
    console.log(offers)
    createOfferEls(offers)
})

//someone just made a new offer and we're already here - call createOfferEls
socket.on('newOfferAwaiting',offers=>{
    createOfferEls(offers)
})

socket.on('answerResponse',offerObj=>{
    console.log(offerObj)
    addAnswer(offerObj)
})

socket.on('updateSpeechToSymbol', (data) => {
    console.log('Received updated speech-to-symbol data:', data);
    const remoteTextDiv = document.querySelector('#remoteText');
    const remoteSymbolDiv = document.querySelector('#remoteSymbols');

    if (remoteTextDiv && remoteSymbolDiv) {
        remoteTextDiv.textContent = data.text;
        remoteSymbolDiv.innerHTML = data.symbol;
    }

});

socket.on('receivedIceCandidateFromServer',iceCandidate=>{
    addNewIceCandidate(iceCandidate)
    console.log(iceCandidate)
})

function createOfferEls(offers){
    //make green answer button for this new offer
    const answerEl = document.querySelector('#answer');
    offers.forEach(o=>{
        console.log(o);
        const newOfferEl = document.createElement('div');
        newOfferEl.innerHTML = `<button class="btn btn-success col-1">Answer ${o.offererUserName}</button>`
        newOfferEl.addEventListener('click',()=>answerOffer(o))
        answerEl.appendChild(newOfferEl);
    })
}

socket.on('callEnded', (data) => {
    console.log("${data.userName} has ended the call");

    // Clear remote video
    remoteVideoEl.srcObject = null;


    document.getElementById('call').disabled = false; // Enable Call button
    document.getElementById('hangup').disabled = true; // Disable Hangup button
});










socket.on('receivedScreenShareStream', (data) => {
    // Handle receiving screen share stream
    screenShareVideo.srcObject = data.streamId;
});


socket.on('screenShareStopped', () => {
    // Handle when the other side stops sharing the screen
    screenShareVideo.srcObject = null;
});