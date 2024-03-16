# Dockerfile-contracts


FROM node:18

WORKDIR /contracts

COPY ./package*.json ./
RUN npm install

COPY . .

CMD npx hardhat typechain && npm run folk-arbitrum

