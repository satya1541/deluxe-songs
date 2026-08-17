module.exports = {
  apps: [
    {
      name: 'deluxe-mix',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 8457',
      env: {
        NODE_ENV: 'production',
        PORT: 8457,
      },
    },
  ],
};
