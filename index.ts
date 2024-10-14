import dotenv from "dotenv";
import { Listing, TrackerAction } from "./types";
import { OpenSeaListingsClient } from "./opensea";
import { TableClient, odata } from "@azure/data-tables";
import { ethers } from "ethers";
import { BlurListingsClient } from "./blur";
import { ListingClient } from "./ListingClient";
import { Connection } from "rabbitmq-client";

dotenv.config();

async function main() {

  const rabbit = new Connection({
    url: process.env.RABBITMQ_CONNECTION,
    connectionName: 'sales-listener'
  });
  rabbit.on('error', (err) => {
    console.log('RabbitMQ connection error', err)
  })
  rabbit.on('connection', () => {
    console.log('Connection successfully (re)established')
  })

  const pub = rabbit.createPublisher({
    // Enable publish confirmations, similar to consumer acknowledgements
    confirm: true,
    // Enable retries
    maxAttempts: 2,
    // Optionally ensure the existence of an exchange before we use it
    exchanges: [{ exchange: 'nft.listings', type: 'fanout', durable: true }]
  })

  const table = TableClient.fromConnectionString(
    process.env.AZURE_STORAGE || "",
    "listings"
  );

  let subscribedContracts = new Set<string>();
  const entities = table.listEntities();
  for await (const entity of entities) {
    if (entity.partitionKey) {
      subscribedContracts.add(entity.partitionKey);
    }
  }

  const listingClients: ListingClient[] = [
    new BlurListingsClient(),
    new OpenSeaListingsClient(),
  ];

  for (const listingClient of listingClients) {
    listingClient.start();
    listingClient.on("listing", async (listing: Listing) => {
      console.log(
        `New listing from ${listing.source} for ${listing.collection} #${listing.token_id}`
      );

      await pub.send({ exchange: 'listings' }, listing)
    });

    for (const collection of subscribedContracts) {
      await listingClient.subscribe(collection);
    }
  }

  const handleNewSubscription = async (message: any) => {
    const body = message as TrackerAction;

    const address = ethers.getAddress(body.address);
    if (body.type === "Listing") {
      for (const listingClient of listingClients) {
        if (body.action === "add") {
          listingClient.subscribe(address);
        } else {
          const remaining = table.listEntities({
            queryOptions: {
              filter: odata`PartitionKey eq '${address}'`,
            },
          });
          let any = false;
          for await (const item of remaining) {
            any = true;
            break;
          }
          if (!any) {
            listingClient.unsubscribe(address);
          }
        }
      }
    }
  }
}

main();
