MAKEFLAGS += --warn-undefined-variables
SHELL := /bin/bash
TAG?=latest
PLATFORM := $(shell echo web/public/platform/{a,b,c}.js)
CERTS := certs/dev.lantern.link.pem

.PHONY: build certs clean install start run stage deploy pack $(PLATFORM)

build: $(PLATFORM) $(CERTS)
	docker-compose -f dc-dev.yml build

install:
	npm install
	
start: $(PLATFORM) $(CERTS)
	HOOK_REMOVE="./test-hook" HOOK_ADD="./test-hook" HOOK_UPDATE="./test-hook" npm start	

run:
	docker-compose -f dc-dev.yml up

stage: $(PLATFORM) 
	docker-compose -f dc-stage.yml build
	docker-compose -f dc-stage.yml up -d

deploy: $(PLATFORM)
	triton profile set-current lantern
	triton-compose -f dc-prod.yml build
	triton-compose -f dc-prod.yml up -d

pack: $(PLATFORM)

clean:
	rm web/public/platform/{a,b,c}.js

certs/dev.lantern.link.pem:
	cd certs && mkcert dev.lantern.link

$(word 1, $(PLATFORM)):
	browserify platform/vendor/core.js \
		platform/vendor/storage.js \
		platform/helpers/array.js \
		platform/helpers/string.js \
		platform/helpers/math.js \
		platform/modules/data/database.js \
		platform/modules/data/organization.js \
		platform/modules/data/package.js \
		platform/modules/data/item.js \
		platform/modules/data/user.js \
		platform/modules/data/feed.js \
		-o $@

$(word 2, $(PLATFORM)):
	browserify platform/config/leaflet.js \
		platform/vendor/map.js \
		platform/modules/mapping/location.js \
		platform/modules/mapping/marker.js \
		platform/modules/mapping/atlas.js  \
		-o $@

$(word 3, $(PLATFORM)):
	browserify platform/modules/display/director.js \
		platform/vendor/display.js \
		platform/modules/display/app.js \
		platform/modules/display/view.js \
		platform/modules/display/menu.js \
		-o $@
