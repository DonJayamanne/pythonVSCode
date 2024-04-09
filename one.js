function sleep(n){
    return new Promise(resolve => setTimeout(resolve, n));
}


async function getNext(it, indexMaybe) {
    const index = indexMaybe === undefined ? -1 : indexMaybe;
    try {
        const result = await it.next();
        return { index, result, err: null };
    }
    catch (err) {
        return { index, err: err, result: null };
    }
}
const NEVER = new Promise(() => {
});
async function* chain(iterators, onError) {
    const promises = iterators.map(getNext);
    let numRunning = iterators.length;
    while (numRunning > 0) {
        const { index, result, err } = await Promise.race(promises);
        if (err !== null) {
            promises[index] = NEVER;
            numRunning -= 1;
            if (onError !== undefined) {
                await onError(err, index);
            }
        }
        else if (result.done) {
            promises[index] = NEVER;
            numRunning -= 1;
            if (result.value !== undefined) {
                yield result.value;
            }
        }
        else {
            promises[index] = getNext(iterators[index], index);
            yield result.value;
        }
    }
}
function iterable(iterator) {
    const it = iterator;
    if (it[Symbol.asyncIterator] === undefined) {
        it[Symbol.asyncIterator] = () => it;
    }
    return it;
}


async function* main1(){
    const counters = [1,2,3,4,5];
    const generators = counters.map(n => {
        async function* generator() {
            console.log(`Start Counter in: ${n}`);
            await sleep(n);
            console.log(`End Counter in: ${n}`);
            yield n
        }
        return generator();
    });

    // for (const x of generators){
    //     for await (const y of x){
    //         console.log(x, y);
    //     }
    // }
    yield* iterable(chain(generators))
}
async function main2(){
    const counters = [1,2,3,4,5];
    const generators = await Promise.all(counters.map(async (n) => {
        console.log(`Start Counter in: ${n}`);
        await sleep(n);
        console.log(`End Counter in: ${n}`);
        return n
    }));
    
    for (const x of generators){
        console.log(x);
    }
}

// main1();
// main2();

async function main(){
    const start = Date.now();
    
    for await (const x of main1()){
        console.log(x);
    }

    console.error('Completed in ', Date.now() - start);
}

main()