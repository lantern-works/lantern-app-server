FROM node:carbon

# Build Arguments
ARG DEBIAN_FRONTEND=noninteractive
ARG APPS_URI=https://github.com/lantern-works/lantern-apps 

# Files & Repositories
RUN apt-get update && apt-get install -y apt-utils \
	&& apt-get install -y nano

RUN mkdir -p /lantern/server/apps

WORKDIR /lantern/server/
COPY package.json .
RUN npm install
RUN mkdir -p ./db
COPY web ./web
COPY certs ./certs
RUN git clone "${APPS_URI}" ./apps;
COPY tiles ./tiles

# Run Web & Database Server
EXPOSE 80
EXPOSE 443
EXPOSE 8765
CMD ["npm", "run", "start"]