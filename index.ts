import dotenv from "dotenv";
import { Listing, TrackerAction } from "./types";
import { OpenSeaListingsClient } from "./opensea";
import {
  MessageHandlers,
  ProcessErrorArgs,
  ServiceBusClient,
  ServiceBusMessage,
} from "@azure/service-bus";
import { TableClient, odata } from "@azure/data-tables";
import { ethers } from "ethers";
import { BlurListingsClient } from "./blur";
import { ListingClient } from "./ListingClient";

dotenv.config();


async function main() {
  const table = TableClient.fromConnectionString(
    process.env.AZURE_STORAGE || "",
    "listings"
  );

  const serviceBusClient = new ServiceBusClient(
    process.env.AZURE_SERVICE_BUS || ""
  );

  let subscribedContracts = new Set<string>();
  const entities = table.listEntities();
  for await (const entity of entities) {
    if (entity.partitionKey) {
      subscribedContracts.add(entity.partitionKey);
    }
  }
  const receiver = serviceBusClient.createReceiver("tracker-updates");

  const listingTopic = serviceBusClient.createSender("listings");
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
      const message: ServiceBusMessage = {
        body: listing,
      };
      await listingTopic.sendMessages(message);
    });

    for (const collection of subscribedContracts) {
      await listingClient.subscribe(collection);
    }
  }

  const handler: MessageHandlers = {
    processMessage: async (message: ServiceBusMessage) => {
      const body = message.body as TrackerAction;

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
    },
    processError: async (error: ProcessErrorArgs) => {},
  };
  receiver.subscribe(handler);
}

main();
