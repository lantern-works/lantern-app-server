MAKEFLAGS += --warn-undefined-variables
SHELL := /bin/bash
TAG?=latest
CERTDIR := ./web/certs/
DEVHOST := dev.lantern.link
CERTS := $(CERTDIR)/dev/$(DEVHOST).pem
VENDOR_CSS := web/public/styles/vendor.css

.PHONY: build certs clean install start run stage deploy

build: $(CERTS)
	docker-compose -f env/dc-dev.yml build

install:
	npm install
	git submodule update --init --recursive
	
start: $(CERTS)
	HOOK_CHANGE="./hooks/change" \
	CHANGE_INTERVAL=6000 \
	HOOK_RESTORE="./hooks/restore" \
	HOOK_BACKUP="./hooks/backup" \
	HOOK_COMMAND="./hooks/command" \
	npm start	

$(VENDOR_CSS):
	cat \
     'node_modules/bulma/css/bulma.min.css' \
     'node_modules/leaflet/dist/leaflet.css' \
     'node_modules/leaflet.locatecontrol/dist/L.Control.Locate.min.css' \
     'node_modules/@fortawesome/fontawesome-free/css/all.min.css' \
     'node_modules/typeface-montserrat/index.css' \
	>> $(VENDOR_CSS)

pack: $(VENDOR_CSS)
	npm run pack

run:
	docker-compose -f env/dc-dev.yml up

stage:
	docker-compose -f env/dc-stage.yml build
	docker-compose -f env/dc-stage.yml up -d

deploy:
	triton profile set-current lantern
	triton-compose -f env/dc-prod.yml build
	triton-compose -f env/dc-prod.yml up -d

clean:
	rm web/public/scripts/data.*
	rm web/public/scripts/apps.*
	rm web/public/scripts/maps.*
	rm web/public/styles/vendor.css

$(CERTS):
	cd $(CERTDIR)/dev && mkcert $(DEVHOST)
