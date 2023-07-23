export const Seaport1_5Abi = [    {
  "anonymous": false,
  "inputs": [
    {
      "indexed": false,
      "internalType": "bytes32",
      "name": "orderHash",
      "type": "bytes32"
    },
    {
      "indexed": true,
      "internalType": "address",
      "name": "offerer",
      "type": "address"
    },
    {
      "indexed": true,
      "internalType": "address",
      "name": "zone",
      "type": "address"
    },
    {
      "indexed": false,
      "internalType": "address",
      "name": "recipient",
      "type": "address"
    },
    {
      "components": [
        {
          "internalType": "enum ItemType",
          "name": "itemType",
          "type": "uint8"
        },
        {
          "internalType": "address",
          "name": "token",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "identifier",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "indexed": false,
      "internalType": "struct SpentItem[]",
      "name": "offer",
      "type": "tuple[]"
    },
    {
      "components": [
        {
          "internalType": "enum ItemType",
          "name": "itemType",
          "type": "uint8"
        },
        {
          "internalType": "address",
          "name": "token",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "identifier",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        },
        {
          "internalType": "address payable",
          "name": "recipient",
          "type": "address"
        }
      ],
      "indexed": false,
      "internalType": "struct ReceivedItem[]",
      "name": "consideration",
      "type": "tuple[]"
    }
  ],
  "name": "OrderFulfilled",
  "type": "event"
},]