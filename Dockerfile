FROM node:18

WORKDIR /usr/app

COPY package.json .
RUN npm i
COPY ./dist .

CMD [ "node", "index.js" ]