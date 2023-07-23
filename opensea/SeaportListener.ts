import {
  EventFragment,
  Interface,
  Provider,
  formatUnits
} from "ethers";
import { Seaport1_5Abi } from "./Seaport1_5Abi";
import { EventEmitter } from "events";
import { Sale } from "../types";

const WETH9 = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const seaport: Interface = new Interface(Seaport1_5Abi);
export class SeaportListener extends EventEmitter {
  started: boolean = false;
  provider: Provider;
  topicSets: string[][];
  orderFulfilled: EventFragment;

  constructor(provider: Provider) {
    super();

    this.provider = provider;

    const seaport: Interface = new Interface(Seaport1_5Abi);
    const orderFulfilled = seaport.getEvent(
      "OrderFulfilled(bytes32,address,address,address,tuple(uint8,address,uint256,uint256)[],tuple(uint8,address,uint256,uint256,address)[])"
    );

    if (!orderFulfilled) {
      throw new Error("Error loading ABI data");
    }

    this.orderFulfilled = orderFulfilled;

    this.topicSets = [[orderFulfilled.topicHash]];

    this.on("newListener", (...args) => {
      if (args[0] === "sale") {
        const existing = this.listeners("sale");
        if (existing.length === 0) {
          this.emit("log", "Starting subscriptions");
          this.start();
        }
      }
    });
    this.on("removeListener", (...args) => {
      console.log(args);
      if (args[0] === "sale") {
        const existing = this.listeners("sale");
        if (existing.length === 0) {
          this.emit("log", "Stopping subscriptions");
          this.stop();
        }
      }
    });
  }

  private stop() {
    this.provider.off(this.topicSets);
    this.started = false;
  }

  private start() {
    if (this.started) {
      return;
    }
    this.started = true;
    this.provider.on(this.topicSets, async (log) => {
      let tokenId, quantity, from, to, price, collection;

      const decoded = seaport.decodeEventLog(
        this.orderFulfilled,
        log.data,
        log.topics
      );

      let type: "Ask" | "Bid" = "Ask";
      let offerAmount = 0n;
      for (const item of decoded.offer) {
        if (item[0] === 1n && item[1] === WETH9) {
          offerAmount += item[3];
          type = "Bid";
        }
      }

      price = 0n;
      if (type === "Bid") {
        collection = decoded.consideration[0][1];
        tokenId = decoded.consideration[0][2];
        quantity = decoded.consideration[0][3];
        price = offerAmount;
        to = decoded.offerer
        from = decoded.recipient
      } else {
        collection = decoded.offer[0][1];
        tokenId = decoded.offer[0][2];
        quantity = decoded.offer[0][3];
        to = decoded.recipient
        from = decoded.offerer

        for (const item of decoded.consideration) {
          price += item[3];
        }
      }

      price = Number(formatUnits(price, "ether"));

      const sale: Sale = {
        amount: price,
        collection,
        orderType: type,
        tokenId: Number(tokenId),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        to,
        from,
        quantity: Number(quantity),
        source: "OpenSea"
      };

      this.emit("sale", sale);
    });
  }
}
