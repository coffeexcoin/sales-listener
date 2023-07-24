import { EventEmitter, WebSocket } from "ws";
import { ListingClient } from "../ListingClient";
import { Listing } from "../types";
import { ethers } from 'ethers'

export class BlurListingsClient extends EventEmitter implements ListingClient {

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

        this.on("ready", (value) => self.ready = value)
        
        this.ws.on('error', console.error);

        this.ws.on('open', function open() {
          console.log("Connected to Blur")
        });

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
                console.log(data)
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
                console.log(payload[0])
                console.log(payload[1])
                if (payload[0].includes("feeds.activity.eventsCreated")) {
                    const contract = ethers.getAddress(payload[1].contractAddress)
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
                            collection: contract,
                            image: item.imageUrl,
                            price: Number(item.price),
                            token_id: item.tokenId,
                            symbol: item.priceUnit,
                            timestamp: item.createdAt,
                            url: `https://blur.io/asset/${contract}/${item.tokenId}`,
                        }
                        self.emit("listing", listing)
                    }
                }
            } else {
                console.log(payload);
            }
        });
    }

    stop(): void {
        this.ws.removeAllListeners()
        this.ws.close()
        this.subscriptions = {}
        this.nonce = 4218
        this.ready = false   
    }

    async subscribe(address: string): Promise<void> {

        address = address.toLowerCase();
        if (this.subscriptions[address]) {
            return;
        }
        const id = ++this.nonce
        this.subscriptions[address] = id;
        const text = `${id}["subscribe",["${address.toLowerCase()}.feeds.activity.eventsCreated"]]`;
        if (this.ready) {
            console.log(`Ready. Sending ${text}`)
            this.ws.send(text)
        } else {
            const self = this;
            console.log(`Not ready. Queuing ${text}`)
            this.once("ready", (value) => {
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
            const text = `${id}["unsubscribe",[${address.toLowerCase()}.feeds.activity.eventsCreated"]]`;
            this.ws.send(text)
        }
    }
    
}