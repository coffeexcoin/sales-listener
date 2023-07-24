
export interface ListingClient extends NodeJS.EventEmitter {

    start(): void
    stop(): void
    subscribe(address: string): Promise<void>
    unsubscribe(address: string): Promise<void>

}