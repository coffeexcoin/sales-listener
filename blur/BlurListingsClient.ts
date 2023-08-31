import { EventEmitter, WebSocket } from "ws";
import { ListingClient } from "../ListingClient";
import { Listing } from "../types";
import { ethers } from 'ethers'

export class BlurListingsClient extends EventEmitter implements ListingClient {

    closing: boolean = false;
    ws: WebSocket
    ready: boolean = false;
    nonce: number = 4218;

    subscriptions: {
        [key: string]: number | undefined
    }

    constructor() {
        super()
        this.subscriptions = {}
        this.ws = new WebSocket("wss://feeds.prod.blur.io/socket.io/?tabId=7LnfVmY71H5L&storageId=NTQTFYTPXhjM&EIO=4&transport=websocket")
    }

    start(): void {
        
        let self = this;
        this.closing = false;
        this.on("ready", (value) => self.ready = value)
        
        this.ws.on('error', console.error);

        this.ws.on('open', function open() {
          console.log("Connected to Blur")
        });

        this.ws.on('close', (code, reason) => {
            if (!self.closing) {
                console.warn("Blur websocket closed unexpectedly. Attempting restart");
                self.stop();
                self.start();
            } else {
                console.log("Blur websocket closed");
            }
        })

        this.ws.on('message', function message(data) {
            const message = data.toString()
            const idx1 = message.indexOf('[')
            const idx2 = message.indexOf('{')
            let idx = Math.min(idx1, idx2)
            if (idx === -1) {
                idx = Math.max(idx1, idx2)
            }
            let payload: any
            let command: number
            if (idx === -1) {
                command = Number(message)
            } else {
                const data = message.substring(idx)
                payload = JSON.parse(data)
                command = Number(message.substring(0, idx))
            }
            if (command !== 2) {
                console.log('received: %s', command)
            }
            if (command === 0) {
                self.ws.send("40")
            } else if (command === 2) {
                self.ws.send("3")
            } else if (command === 40) {
                self.emit("ready", true)
            } else if (command === 42) {
                if (payload[0].includes("feeds.activity.eventsCreated")) {
                    const contractAddress = payload[1].contractAddress
                    const collection = ethers.getAddress(payload[1].contractAddress)
                    for(const item of payload[1].items) {
                        if (item.marketplace !== 'BLUR') {
                            continue
                        }
                        if (item.eventType !== 'ORDER_CREATED') {
                            continue
                        }
                        const listing: Listing = {
                            source: 'blur.io',
                            seller: item.fromAddress,
                            collection,
                            image: item.imageUrl,
                            price: Number(item.price),
                            token_id: item.tokenId,
                            symbol: item.priceUnit,
                            timestamp: item.createdAt,
                            url: `https://blur.io/asset/${contractAddress}/${item.tokenId}`,
                        }
                        self.emit("listing", listing)
                    }
                } else {
                    console.log(payload)
                }
            } else {
                console.log(payload);
            }
        });
    }

    stop(): void {
        this.closing = true;
        this.ws.close()
        this.nonce = 4218
        this.ready = false
        this.ws = new WebSocket(this.ws.url);
    }

    async subscribe(address: string): Promise<void> {

        address = address.toLowerCase();
        if (this.subscriptions[address]) {
            return;
        }
        const id = ++this.nonce
        this.subscriptions[address] = id;
        const text = `${id}["subscribe",["${address}.feeds.activity.eventsCreated"]]`;
        if (this.ready) {
            console.log(`Ready. Sending ${text}`)
            this.ws.send(text)
        } else {
            const self = this;
            console.log(`Not ready. Queuing ${text}`)
            this.on("ready", (value) => {
                if (value) {
                    console.log(`Sending: ${text}`)
                    self.ws.send(text)
                }
            })
        }
    }

    async unsubscribe(address: string): Promise<void> {
        address = address.toLowerCase();

        if (this.subscriptions[address]) {
            const id = this.subscriptions[address]
            this.subscriptions[address] = undefined
            const text = `${id}["unsubscribe",[${address}.feeds.activity.eventsCreated"]]`;
            this.ws.send(text)
        }
    }
    
}