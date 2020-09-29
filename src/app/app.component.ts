import { ChangeDetectorRef, Component, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { MediaMatcher } from '@angular/cdk/layout';
import adapter from 'webrtc-adapter';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnDestroy, AfterViewInit {

  @ViewChild('video', { static: false }) video: ElementRef;
  @ViewChild('localVideo', { static: false }) localVideo: ElementRef;
  @ViewChild('remoteVideo', { static: false }) remoteVideo: ElementRef;
  mediaStreamConstraints = {
    video: true,
  };

  // Set up to exchange only video.
  offerOptions = {
    offerToReceiveVideo: 1,
  };

  // Define initial start time of the call (defined as connection between peers).
  startTime = null;

  localStream;
  remoteStream;
  localPeerConnection;
  remotePeerConnection;

  private displayMediaOptions = {
    video: {
      cursor: 'always'
    },
    audio: false
  };

  private videoElem;
  mobileQuery: MediaQueryList;
  fillerNav = Array.from({ length: 50 }, (_, i) => `Nav Item ${i + 1}`);
  private mobileQueryListener: () => void;

  constructor(changeDetectorRef: ChangeDetectorRef, media: MediaMatcher) {
    this.mobileQuery = media.matchMedia('(max-width: 600px)');
    this.mobileQueryListener = () => changeDetectorRef.detectChanges();
    this.mobileQuery.addEventListener('change', this.mobileQueryListener);
  }

  public ngOnDestroy(): void {
    this.mobileQuery.removeEventListener('change', this.mobileQueryListener);
  }

  public ngAfterViewInit(): void {
    this.localVideo.nativeElement.addEventListener('loadedmetadata', (event) => this.logVideoLoaded(event));
    this.remoteVideo.nativeElement.addEventListener('loadedmetadata', (event) => this.logVideoLoaded(event));
    this.remoteVideo.nativeElement.addEventListener('onresize', (event) => this.logResizedVideo(event));
  }

  public stop(): void {
    const tracks = this.videoElem.srcObject.getTracks();

    tracks.forEach(track => track.stop());
    this.videoElem.srcObject = null;
  }
  public async start(): Promise<void> {
    this.videoElem = this.video.nativeElement;
    try {
      const mediaDevices = navigator.mediaDevices as any;
      this.videoElem.srcObject = await mediaDevices.getDisplayMedia(this.displayMediaOptions);
      this.dumpOptionsInfo();
    } catch (err) {
      console.error('Error: ' + err);
    }
  }

  public getOtherPeer(peerConnection): any {
    return (peerConnection === this.localPeerConnection) ?
      this.remotePeerConnection : this.localPeerConnection;
  }

  // Gets the name of a certain peer connection.
  public getPeerName(peerConnection): 'localPeerConnection' | 'remotePeerConnection' {
    return (peerConnection === this.localPeerConnection) ?
      'localPeerConnection' : 'remotePeerConnection';
  }

  // Logs an action (text) and the time when it happened on the console.
  public trace(text): void {
    text = text.trim();
    const now = (window.performance.now() / 1000).toFixed(3);
    console.log(now, text);
  }
  public startCo(): void {
    (navigator.mediaDevices as any).getUserMedia(this.mediaStreamConstraints)
      .then((stream) => this.gotLocalMediaStream(stream)).catch((error) => this.handleLocalMediaStreamError(error));
    this.trace('Requesting local stream.');
  }

  public call(): void {
    this.trace('Starting call.');
    this.startTime = window.performance.now();

    // Get local media stream tracks.
    const videoTracks = this.localStream.getVideoTracks();
    const audioTracks = this.localStream.getAudioTracks();
    if (videoTracks.length > 0) {
      this.trace(`Using video device: ${videoTracks[0].label}.`);
    }
    if (audioTracks.length > 0) {
      this.trace(`Using audio device: ${audioTracks[0].label}.`);
    }

    const servers = null;  // Allows for RTC server configuration.

    // Create peer connections and add behavior.
    this.localPeerConnection = new RTCPeerConnection(servers);
    this.trace('Created local peer connection object localPeerConnection.');

    this.localPeerConnection.addEventListener('icecandidate', (event) => this.handleConnection(event));
    this.localPeerConnection.addEventListener(
      'iceconnectionstatechange', (event) => this.handleConnectionChange(event));

    this.remotePeerConnection = new RTCPeerConnection(servers);
    this.trace('Created remote peer connection object remotePeerConnection.');

    this.remotePeerConnection.addEventListener('icecandidate', (event) => this.handleConnection(event));
    this.remotePeerConnection.addEventListener(
      'iceconnectionstatechange', (event) => this.handleConnectionChange(event));
    this.remotePeerConnection.addEventListener('addstream', (event) => this.gotRemoteMediaStream(event));

    // Add local stream to connection and create offer to connect.
    this.localPeerConnection.addStream(this.localStream);
    this.trace('Added local stream to localPeerConnection.');

    this.trace('localPeerConnection createOffer start.');
    this.localPeerConnection.createOffer(this.offerOptions)
      .then((desc) => this.createdOffer(desc)).catch((error) => this.setSessionDescriptionError(error));
  }

  public hangUp(): void {
    this.localPeerConnection.close();
    this.remotePeerConnection.close();
    this.localPeerConnection = null;
    this.remotePeerConnection = null;
    this.trace('Ending call.');
  }

  private dumpOptionsInfo(): void {
    const videoTrack = this.videoElem.srcObject.getVideoTracks()[0];
    console.log('Track settings:');
    console.log(JSON.stringify(videoTrack.getSettings(), null, 2));
    console.log('Track constraints:');
    console.log(JSON.stringify(videoTrack.getConstraints(), null, 2));
  }




  public gotLocalMediaStream(mediaStream): void {
    this.localVideo.nativeElement.srcObject = mediaStream;
    this.localStream = mediaStream;
    this.trace('Received local stream.');
  }

  // Handles error by logging a message to the console.
  public handleLocalMediaStreamError(error): void {
    this.trace(`navigator.getUserMedia error: ${error.toString()}.`);
  }

  // Handles remote MediaStream success by adding it as the remoteVideo src.
  public gotRemoteMediaStream(event): void {
    const mediaStream = event.stream;
    this.remoteVideo.nativeElement.srcObject = mediaStream;
    this.remoteStream = mediaStream;
    this.trace('Remote peer connection received remote stream.');
  }


  // Add behavior for video streams.

  // Logs a message with the id and size of a video element.
  public logVideoLoaded(event): void {
    const video = event.target;
    this.trace(`${video.id} videoWidth: ${video.videoWidth}px, ` +
      `videoHeight: ${video.videoHeight}px.`);
  }

  // Logs a message with the id and size of a video element.
  // This event is fired when video begins streaming.
  public logResizedVideo(event): void {
    this.logVideoLoaded(event);
    if (this.startTime) {
      const elapsedTime = window.performance.now() - this.startTime;
      this.startTime = null;
      this.trace(`Setup time: ${elapsedTime.toFixed(3)}ms.`);
    }
  }



  public handleConnection(event): void {
    const peerConnection = event.target;
    const iceCandidate = event.candidate;

    if (iceCandidate) {
      const newIceCandidate = new RTCIceCandidate(iceCandidate);
      const otherPeer = this.getOtherPeer(peerConnection);

      otherPeer.addIceCandidate(newIceCandidate)
        .then(() => {
          this.handleConnectionSuccess(peerConnection);
        }).catch((error) => {
          this.handleConnectionFailure(peerConnection, error);
        });

      this.trace(`${this.getPeerName(peerConnection)} ICE candidate:\n` +
        `${event.candidate.candidate}.`);
    }
  }

  // Logs that the connection succeeded.
  public handleConnectionSuccess(peerConnection): void {
    this.trace(`${this.getPeerName(peerConnection)} addIceCandidate success.`);
  }

  // Logs that the connection failed.
  public handleConnectionFailure(peerConnection, error): void {
    this.trace(`${this.getPeerName(peerConnection)} failed to add ICE Candidate:\n` +
      `${error.toString()}.`);
  }

  // Logs changes to the connection state.
  public handleConnectionChange(event): void {
    const peerConnection = event.target;
    console.log('ICE state change event: ', event);
    this.trace(`${this.getPeerName(peerConnection)} ICE state: ` +
      `${peerConnection.iceConnectionState}.`);
  }

  // Logs error when setting session description fails.
  public setSessionDescriptionError(error): void {
    this.trace(`Failed to create session description: ${error.toString()}.`);
  }

  // Logs success when setting session description.
  public setDescriptionSuccess(peerConnection, functionName): void {
    const peerName = this.getPeerName(peerConnection);
    this.trace(`${peerName} ${functionName} complete.`);
  }

  // Logs success when localDescription is set.
  public setLocalDescriptionSuccess(peerConnection): void {
    this.setDescriptionSuccess(peerConnection, 'setLocalDescription');
  }

  // Logs success when remoteDescription is set.
  public setRemoteDescriptionSuccess(peerConnection): void {
    this.setDescriptionSuccess(peerConnection, 'setRemoteDescription');
  }

  // Logs offer creation and sets peer connection session descriptions.
  public createdOffer(description): void {
    this.trace(`Offer from localPeerConnection:\n${description.sdp}`);

    this.trace('localPeerConnection setLocalDescription start.');
    this.localPeerConnection.setLocalDescription(description)
      .then(() => {
        this.setLocalDescriptionSuccess(this.localPeerConnection);
      }).catch((error) => this.setSessionDescriptionError(error));

    this.trace('remotePeerConnection setRemoteDescription start.');
    this.remotePeerConnection.setRemoteDescription(description)
      .then(() => {
        this.setRemoteDescriptionSuccess(this.remotePeerConnection);
      }).catch((error) => this.setSessionDescriptionError(error));

    this.trace('remotePeerConnection createAnswer start.');
    this.remotePeerConnection.createAnswer()
      .then((desc) => this.createdAnswer(desc))
      .catch((error) => this.setSessionDescriptionError(error));
  }

  // Logs answer to offer creation and sets peer connection session descriptions.
  public createdAnswer(description): void {
    this.trace(`Answer from remotePeerConnection:\n${description.sdp}.`);

    this.trace('remotePeerConnection setLocalDescription start.');
    this.remotePeerConnection.setLocalDescription(description)
      .then(() => {
        this.setLocalDescriptionSuccess(this.remotePeerConnection);
      }).catch((error) => this.setSessionDescriptionError(error));

    this.trace('localPeerConnection setRemoteDescription start.');
    this.localPeerConnection.setRemoteDescription(description)
      .then(() => {
        this.setRemoteDescriptionSuccess(this.localPeerConnection);
      }).catch((error) => this.setSessionDescriptionError(error));
  }


}
