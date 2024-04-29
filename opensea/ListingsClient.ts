import { ItemListedEvent, OpenSeaStreamClient } from "@opensea/stream-js";
import { EventEmitter, WebSocket } from "ws";
import { ethers } from "ethers";
import { Listing } from "../types";
import { ListingClient } from "../ListingClient";

export class OpenSeaListingsClient extends EventEmitter implements ListingClient {
  private started = false;
  private unsubscribes: { [key: string]: (() => void) | undefined } = {};
  private client: OpenSeaStreamClient;
  constructor() {
    super()
    const self = this;
    this.client = new OpenSeaStreamClient({
      token: process.env.OS_API_KEY || "",
      connectOptions: {
        transport: WebSocket,
      },
      onError: (err) => {
        console.error(err);
        if (self.started) {
          self.start();
        }
      }
    });
  }

  start() {
    const self = this;
    this.client.connect();
    self.started = true;
    console.log("Connected to OpenSea");
  }

  async subscribe(contract: string) {
    const slug = await this.getSlugForContract(contract);

    if (!slug || this.unsubscribes[slug]) {
      return;
    }

    const self = this;
    this.unsubscribes[slug] = this.client.onItemListed(slug, (listing) => {
        self.ItemListed(listing, (l) => self.emit("listing", l))
    });
  }

  async unsubscribe(contract: string) {
    const slug = await this.getSlugForContract(contract);
    if (!slug) {
        return
    }
    this.unsubscribes[slug]?.();
    this.unsubscribes[slug] = undefined;
  }

  stop() {
    this.started = false;
    this.client.disconnect();
  }

  private async getSlugForContract(contract: string) {
    const options = {
      method: "GET",
      headers: { "X-API-KEY": process.env.OS_API_KEY || "" },
    };

    try {
        const resp = await fetch(
        `https://api.opensea.io/api/v1/asset_contract/${contract}`,
        options
        );
        const data = await resp.json();
        const slug = data.collection.slug;
        return slug
    } catch (err) {
        return undefined
    }
  }

  private ItemListed(listed: ItemListedEvent, emit: (listing: Listing) => void) {
    const price =
      Number(listed.payload.base_price) /
      10 ** listed.payload.payment_token.decimals;
    const usdPrice =
      Number(price) * Number(listed.payload.payment_token.usd_price);

    const tokenDeets = listed.payload.item.nft_id.split("/");
    const collection = ethers.getAddress(tokenDeets[1]);
    const listing: Listing = {
      source: "opensea.io",
      collection,
      image: listed.payload.item.metadata.image_url,
      url: listed.payload.item.permalink,
      price,
      usdPrice,
      symbol: listed.payload.payment_token.symbol,
      token_id: tokenDeets[2],
      seller: listed.payload.maker.address,
      timestamp: listed.sent_at
    };
    emit(listing);
  }
}
