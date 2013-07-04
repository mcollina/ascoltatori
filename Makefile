test:
	./node_modules/.bin/mocha --recursive test

bail:
	./node_modules/.bin/mocha --recursive --bail --reporter spec test 

ci:
	./node_modules/.bin/mocha --recursive --watch test

jshint:
	find lib -name "*.js" -print0 | xargs -0 ./node_modules/.bin/jshint
	find test -name "*.js" -print0 | xargs -0 ./node_modules/.bin/jshint

BEAUTIFY=node_modules/.bin/js-beautify -r -s 2
beautify:
	find lib -name "*.js" -print0 | xargs -0 $(BEAUTIFY)
	find test -name "*.js" -print0 | xargs -0 $(BEAUTIFY)

bench-clean:
	rm -rf ./benchmarks/results

bench-setup: bench-clean
	mkdir -p ./benchmarks/results

BENCH_ARGS="-r 100"
bench-1: bench-setup
	node ./benchmarks/multi_listeners.js -c TrieAscoltatore $(BENCH_ARGS) -l 1 -d >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c EventEmitter2Ascoltatore $(BENCH_ARGS) -l 1 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c RedisAscoltatore $(BENCH_ARGS) -l 1 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c ZeromqAscoltatore $(BENCH_ARGS) -l 1 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c AMQPAscoltatore $(BENCH_ARGS) -l 1 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c MQTTAscoltatore $(BENCH_ARGS) -l 1 >> ./benchmarks/results/multi_listeners

bench-10: bench-setup
	node ./benchmarks/multi_listeners.js -c TrieAscoltatore $(BENCH_ARGS) -l 10 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c EventEmitter2Ascoltatore $(BENCH_ARGS) -l 10 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c RedisAscoltatore $(BENCH_ARGS) -l 10 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c ZeromqAscoltatore $(BENCH_ARGS) -l 10 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c AMQPAscoltatore $(BENCH_ARGS) -l 10 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c MQTTAscoltatore $(BENCH_ARGS) -l 10 >> ./benchmarks/results/multi_listeners

bench-100: bench-setup
	node ./benchmarks/multi_listeners.js -c TrieAscoltatore $(BENCH_ARGS) -l 100 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c EventEmitter2Ascoltatore $(BENCH_ARGS) -l 100 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c RedisAscoltatore $(BENCH_ARGS) -l 100 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c ZeromqAscoltatore $(BENCH_ARGS) -l 100 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c AMQPAscoltatore $(BENCH_ARGS) -l 100 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c MQTTAscoltatore $(BENCH_ARGS) -l 100 >> ./benchmarks/results/multi_listeners

bench-1000: bench-setup
	node ./benchmarks/multi_listeners.js -c TrieAscoltatore $(BENCH_ARGS) -l 1000 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c EventEmitter2Ascoltatore $(BENCH_ARGS) -l 1000 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c RedisAscoltatore $(BENCH_ARGS) -l 1000 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c ZeromqAscoltatore $(BENCH_ARGS) -l 1000 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c AMQPAscoltatore $(BENCH_ARGS) -l 1000 >> ./benchmarks/results/multi_listeners
	node ./benchmarks/multi_listeners.js -c MQTTAscoltatore $(BENCH_ARGS) -l 1000 >> ./benchmarks/results/multi_listeners

bench: bench-clean bench-1 bench-10 bench-100 bench-1000

docs-clean:
	rm -rf docs

docs: docs-clean
	./node_modules/.bin/dox-foundation --source lib --target docs --title Ascoltatori

publish-docs: docs
	git stash	
	rm -rf /tmp/ascoltatori-docs
	cp -R docs /tmp/ascoltatori-docs
	git checkout gh-pages
	git pull origin gh-pages
	rm -rf docs
	cp -R /tmp/ascoltatori-docs docs
	git add docs
	git add -u
	git commit -m "Updated docs"
	git push origin
	git checkout master
	git stash apply

install-pre-commit:
	ln -s precommit.sh .git/hooks/pre-commit

.PHONY: test
