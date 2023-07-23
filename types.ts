export type Sale = {
    txHash: `0x${string}`
    blockNumber: number
    collection: string
    from: string
    to: string
    tokenId: number
    amount: number
    orderType: "Bid" | "Ask"
    quantity: number,
    source: string
}

export type Listing = {
    source: string
    collection: string
    slug: string
    image: string | null,
    url: string,
    price: number,
    usdPrice: number,
    symbol: string,
    token_id: string,
    seller: string,
    timestamp: string
}

export type TrackerAction = {
    address: string,
    type: 'Wallet'|'Collection'|'Listing',
    action: 'add'|'remove'
}