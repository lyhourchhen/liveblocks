<p align="center">
  <a href="https://liveblocks.io">
    <img src="https://liveblocks.io/icon-192x192.png" height="96">
  </a>
</p>

# [Liveblocks](https://liveblocks.io) × [Next.js](https://nextjs.org/).

This repo shows how to use Liveblocks with [Next.js](https://nextjs.org/).

> :warning: **This demo will not work if you don't have access to the private beta. Please contact us at hello@liveblocks.io if you want access to the storage block private beta**

![todo-list-screenshot](https://liveblocks.io/_next/image?url=%2Fimages%2Fexamples%2Fthumbnail-todo-list.png&w=1200&q=90)

## Getting started

### Run examples locally

- Install all dependencies with `npm install`

- Create an account on [liveblocks.io](https://liveblocks.io/dashboard)

- Copy your secret key from the [administration](https://liveblocks.io/dashboard/apikeys)

- Create a file named `.env.local` and add your Liveblocks secret as environment variable `LIVEBLOCKS_SECRET_KEY=sk_test_yourkey`

- Run `npm run dev` and go to [http://localhost:3000](http://localhost:3000)

### Run examples on CodeSandbox

- Open this repository on CodeSandbox with this [link](https://codesandbox.io/s/github/liveblocks/liveblocks/tree/main/examples/nextjs-live-todo-list)

- Create an account on [liveblocks.io](https://liveblocks.io/dashboard)

- Copy your secret key from the [administration](https://liveblocks.io/dashboard/apikeys)

- Create [secret](https://codesandbox.io/docs/secrets) named `LIVEBLOCKS_SECRET_KEY` with the secret key you just copied. You need to create an account on CodeSandbox to add an environment variable.

- Refresh your browser and you should be good to go!
