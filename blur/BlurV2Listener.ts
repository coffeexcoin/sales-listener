import {
  EventFragment,
  Interface,
  Provider,
  formatUnits,
  getAddress,
  mask,
  toBeHex,
} from "ethers";
import { BlurV2Abi } from "./BlurV2Abi";
import { EventEmitter } from "events";
import { Sale } from "../types";

const blur: Interface = new Interface(BlurV2Abi);
export class BlurV2Listener extends EventEmitter {
  started: boolean = false;
  provider: Provider;
  topicSets: string[][];
  execution721Packed: EventFragment;
  execution721MakerFeePacked: EventFragment;
  execution721TakerFeePacked: EventFragment;

  constructor(provider: Provider) {
    super()

    this.provider = provider;
    const execution721Packed = blur.getEvent(
      "Execution721Packed(bytes32,uint256,uint256)"
    );
    const execution721MakerFeePacked = blur.getEvent(
      "Execution721MakerFeePacked(bytes32,uint256,uint256,uint256)"
    );
    const execution721TakerFeePacked = blur.getEvent(
      "Execution721TakerFeePacked(bytes32,uint256,uint256,uint256)"
    );

    if (
      !execution721Packed ||
      !execution721MakerFeePacked ||
      !execution721TakerFeePacked
    ) {
      throw new Error("Error loading ABI data");
    }

    this.execution721Packed = execution721Packed;
    this.execution721MakerFeePacked = execution721MakerFeePacked;
    this.execution721TakerFeePacked = execution721TakerFeePacked;

    this.topicSets = [
      [
        execution721Packed.topicHash,
        execution721MakerFeePacked.topicHash,
        execution721TakerFeePacked.topicHash,
      ],
    ];

    this.on("newListener", (...args) => {
        if (args[0] === "sale") {
            const existing = this.listeners("sale")
            if (existing.length === 0) {
                this.emit("log", "Starting subscriptions")
                this.start()
            }
        }
    })
    this.on("removeListener", (...args) => {
        console.log(args)
        if (args[0] === "sale") {
            const existing = this.listeners("sale")
            if (existing.length === 0) {
                this.emit("log", "Stopping subscriptions")
                this.stop()
            }
        }
    })
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
      const topicSets = this.topicSets[0];

      let tokenId, listingIndex, trader, orderType, price, collection;

      const tx = await this.provider.getTransaction(log.transactionHash);
      if (!tx) {
        return;
      }

      if (log.topics[0] == topicSets[0]) {
        const decoded = blur.decodeEventLog(this.execution721Packed, log.data);

        tokenId = decoded.tokenIdListingIndexTrader >> BigInt(21 * 8); // token id
        listingIndex = mask(
          decoded.tokenIdListingIndexTrader >> BigInt(20 * 8),
          8
        );
        trader = mask(decoded.tokenIdListingIndexTrader, 20 * 8);
        orderType = decoded.collectionPriceSide >> BigInt(31 * 8);
        price = mask(decoded.collectionPriceSide >> BigInt(20 * 8), 11 * 8);
        collection = mask(decoded.collectionPriceSide, 20 * 8);
      } else if (log.topics[0] == topicSets[1]) {
        const decoded = blur.decodeEventLog(
          this.execution721MakerFeePacked,
          log.data
        );
        tokenId = decoded.tokenIdListingIndexTrader >> BigInt(21 * 8); // token id
        listingIndex = mask(
          decoded.tokenIdListingIndexTrader >> BigInt(20 * 8),
          8
        );
        trader = mask(decoded.tokenIdListingIndexTrader, 20 * 8);

        orderType = decoded.collectionPriceSide >> BigInt(31 * 8);
        price = mask(decoded.collectionPriceSide >> BigInt(20 * 8), 11 * 8);
        collection = mask(decoded.collectionPriceSide, 20 * 8);
      } else if (log.topics[0] == topicSets[2]) {
        const decoded = blur.decodeEventLog(
          this.execution721TakerFeePacked,
          log.data
        );

        tokenId = decoded.tokenIdListingIndexTrader >> BigInt(21 * 8); // token id
        listingIndex = mask(
          decoded.tokenIdListingIndexTrader >> BigInt(20 * 8),
          8
        );
        trader = mask(decoded.tokenIdListingIndexTrader, 20 * 8);

        orderType = decoded.collectionPriceSide >> BigInt(31 * 8);
        price = mask(decoded.collectionPriceSide >> BigInt(20 * 8), 11 * 8);
        collection = mask(decoded.collectionPriceSide, 20 * 8);
      } else {
        console.log("No Match");
        console.log(log.topics[0]);
        return;
      }

      const type = orderType === 0n ? "Ask" : "Bid";

      price = Number(formatUnits(price, "ether"));

      const sale: Sale & { listingIndex: number } = {
        amount: price,
        collection: getAddress(toBeHex(collection, 20)),
        orderType: type,
        tokenId: Number(tokenId),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        to: orderType === 0n ? tx.from : getAddress(toBeHex(trader, 20)),
        from: orderType === 0n ? getAddress(toBeHex(trader, 20)) : tx.from,
        listingIndex: Number(listingIndex),
        quantity: 1,
        source: "Blur"
      };

      this.emit("sale", sale);
    });
  }
}
