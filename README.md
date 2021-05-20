# OpenAI NodeJS

A non-official [OpenAI API](https://beta.openai.com/docs/api-reference/introduction) wrapper for node.

# Getting Started

## Installation

If you have [npm installed](https://www.npmjs.com/get-npm), start using openai-nodejs with the following commands.

```bash
npm install openai-nodejs
```

## Usage

openai-nodejs follows the latest [maintenance LTS](https://github.com/nodejs/Release#release-schedule) version of Node.

**Example** - Complete the phrase "My name is Bond"

```js
const OpenAI = require('openai-nodejs');
const client = new OpenAI('YOUR_API_KEY');

var prompt = 'My name is Bond';
client.complete(prompt, {stop: ['\n', '"'], temperature: 0})
.then(completion => {
    console.log(`Result: ${prompt}${completion.choices[0].text}`);
})
.catch(console.error);
```

The likely answer will be ", James Bond!"

__If you want to see more examples, please check our [documentation](https://useems.github.io/openai-nodejs/).__

# Documentation

You can check the full API reference [here](https://useems.github.io/openai-nodejs/).
\
\
Note: Some API parameter descriptions adopted from [OpenAI's API Reference](https://beta.openai.com/docs/api-reference). If you use the Official OpenAI's API docs as your primary reference, be aware that this library has some differences compared to it.

## License
[MIT](https://github.com/Useems/openai-nodejs/tree/main/LICENSE)