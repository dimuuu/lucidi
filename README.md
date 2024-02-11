# Lucidi for Figma

Create & sync opacity styles based on primary opaque color styles in Figma.

## About

Figma doesn't support maintaining layer style while changing opacity, so designers have to keep and update color styles for multiple opacities. Doing this manually can become a nightmare, so I made a plugin to automatically create, sync and update these styles.

### Features

**Quickly create opacity styles based of current solid color styles**

1. Enter a list of opacities you need in your color library;
2. Write a pattern for style name (e.g. for a style called "primary" the pattern `$N-alpha$A` will turn into `primary-alpha50`);
3. Press "Create & sync styles".

**Sync your existing colors when solid solid opaque colors change**

Don't manually update values of opacity colors styles, just change your main color style and start the plugin.

**Clean up unused opacity styles**

Optionally rewrite and delete opacity styles that don't match your parameters.

### Running the project locally

1. Clone the repo

   ```sh
   git clone https://github.com/dimuuu/lucidi.git
   ```

2. Install NPM packages

   ```sh
   pnpm install
   ```

3. Run & build plugin

   ```sh
   pnpm run dev
   ```

## License

Distributed under the CC0 License. See `LICENSE` for more information.

## Contact

Twitter: [@dimuuu\_](https://twitter.com/dimuuu_)

Email: dmytro.kondakov@gmail.com
