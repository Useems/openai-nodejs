const gpt3encoder = require('gpt-3-encoder');
const { typeCheck } = require('type-check');
const FormData = require('form-data');

const axios = require('axios').create({
	baseURL: 'https://api.openai.com/v1'
});

const stream = require('stream');
const assert = require('assert');

const parameters = require('./utils/parameters.json');
const RequestError = require('./utils/RequestError');
const { ReadStream } = require('fs');

/**
 * OpenAI client library.
 */
class OpenAI {
	#api_key;
	#organization_id;

	/**
	 * @param {String} key API key
	 * @param {String} [organization=null] Organization ID
	 * @param {String} [engine=davinci] The engine you will use in your requests
	 * @see https://beta.openai.com/docs/api-reference/authentication
	 */
	constructor(key, organization = null, engine = 'davinci') {
		assert.strictEqual(typeof key, 'string', 'key must be a string');
		assert.ok(organization ? typeof organization === 'string' : true, 'organization must be a string');
		assert.ok(engine ? typeof engine === 'string' : true, 'engine must be a string');

		this.#api_key = key;
		this.#organization_id = organization;

		this.engine = engine;
	}

	_request(endpoint = '', request_content = {}, request_type = 'POST', custom_header = {}) {
		assert.strictEqual(typeof endpoint, 'string', 'endpoint must be a string');
		assert.strictEqual(typeof request_content, 'object', 'request_content must be an object');
		assert.strictEqual(typeof request_type, 'string', 'request_type must be a string');
		assert.strictEqual(typeof custom_header, 'object', 'custom_header must be a string');

		request_type = request_type.toUpperCase();

		assert.ok(request_type === 'GET' || request_type === 'POST' || request_type === 'DELETE', 'invalid request_type');

		let headers = {
            'Authorization': 'Bearer ' + this.#api_key,
		}

		if (this.#organization_id)
			headers['OpenAI-Organization'] = this.#organization_id;

		if (request_type === 'POST')
			headers['content-type'] = 'application/json';

		headers = {...headers, ...custom_header};

		if (request_type === 'POST')
			return axios.post(endpoint, request_content, {headers});
		else if (request_type === 'GET')
			return axios.get(endpoint, {headers, params: request_content});
		else if (request_type === 'DELETE')
			return axios.delete(endpoint, {headers, request_content});
	}

	/**
	 * @typedef {Object} Engine
	 * 
	 * @property {String} id
	 * @property {String} object
	 * @property {Number|null} created
	 * @property {Number|null} max_replicas
	 * @property {String} owner
	 * @property {any} permissions
	 * @property {boolean} ready
	 * @property {boolean|null} ready_replicas
	 * @property {any} ready_replicas
	 * @see https://beta.openai.com/docs/api-reference/engines
	 */

	/**
	 * Lists the currently available engines, and provides basic information about each one such as the owner and availability.
	 * @returns {Promise<Array<Engine>>}
	 * @example
	 * const OpenAI = require('openai-nodejs');
	 * const client = new OpenAI('YOUR_API_KEY');
	 *
	 * client.getEngines()
	 * .then(engines => {
	 *     console.log(`Engines: ${engines.map(engine => engine.id).join(', ')}`);
	 * })
	 * .catch(console.error);
	 * 
	 * @see https://beta.openai.com/docs/api-reference/engines/list
	 */
	async getEngines() {
		return this._request('/engines', {}, 'GET')
		.then(res => res.data.data)
		.catch(err => {
			throw new RequestError(err.response.data.error);
		});
	}

	/**
	 * Retrieves an engine instance, providing basic information about the engine such as the owner and availability.
	 * @param {String} engine The ID of the engine to use for this request
	 * @returns {Promise<Engine>}
	 * @example
	 * const OpenAI = require('openai-nodejs');
	 * const client = new OpenAI('YOUR_API_KEY');
	 *
	 * client.getEngine('davinci')
	 * .then(engine => {
	 *     console.log(`Engine owner: ${engine.owner}`);
	 * })
	 * .catch(console.error);
	 * 
	 * @see https://beta.openai.com/docs/api-reference/engines/retrieve
	 */
	async getEngine(engine) {
		assert.strictEqual(typeof engine, 'string', 'engine must be a string');

		return this._request('/engines/' + engine, {}, 'GET')
		.then(res => res.data)
		.catch(err => {
			throw new RequestError(err.response.data.error);
		});
	}

	/**
	 * @typedef {Object} Completion
	 * 
	 * @property {String} id
	 * @property {String} object
	 * @property {Number|null} created
	 * @property {String} model
	 * @property {array<CompletionChoice>} choices
	 * @see https://beta.openai.com/docs/api-reference/completions
	 */

	/**
	 * @typedef {Object} CompletionBody
	 * 
	 * @property {Number} [max_tokens] The maximum number of tokens to generate.
	 * @property {Number} [temperature] What sampling temperature to use.
	 * @property {Number} [top_p] An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass.
	 * @property {Number} [n] How many completions to generate for each prompt.
	 * @property {Boolean} [stream] Whether to stream back partial progress.
	 * @property {Number} [logprobs] Include the log probabilities on the logprobs most likely tokens, as well the chosen tokens.
	 * @property {Boolean} [echo] Echo back the prompt in addition to the completion
	 * @property {String|Array<String>} [stop] Up to 4 sequences where the API will stop generating further tokens.
	 * @property {Number} [presence_penalty] Number between 0 and 1 that penalizes new tokens based on whether they appear in the text so far.
	 * @property {Number} [frequency_penalty] Number between 0 and 1 that penalizes new tokens based on their existing frequency in the text so far.
	 * @property {Number} [best_of] Generates best_of completions server-side and returns the "best" (the one with the lowest log probability per token).
	 * @property {Object} [logit_bias] Modify the likelihood of specified tokens appearing in the completion.
	 * @see https://beta.openai.com/docs/api-reference/completions
	 */

	/**
	 * @typedef {Object} CompletionChoice
	 * 
	 * @property {String} text
	 * @property {Number} index
	 * @property {Number|null} logprobs
	 * @property {String} finish_reason
	 * @see https://beta.openai.com/docs/api-reference/completions
	 */

	/**
	 * Creates a new completion for the provided prompt and parameters.
	 * @param {string|array} [prompt=<|endoftext|>] The prompt(s) to generate completions for, encoded as a string, a list of strings, or a list of token lists.
	 * @param {CompletionBody} [body={}]
	 * @returns {Promise<Completion>}
	 * @example
	 * const OpenAI = require('openai-nodejs');
	 * const client = new OpenAI('YOUR_API_KEY');
	 *
	 * var prompt = 'My name is Bond';
	 * client.complete(prompt, {stop: ['\n', '"'], temperature: 0})
	 * .then(completion => {
	 *     console.log(`Result: ${prompt}${completion.choices[0].text}`);
	 * })
	 * .catch(console.error);
	 * 
	 * @see https://beta.openai.com/docs/api-reference/completions/create
	 */
	async complete(prompt, body = {}) {
		assert.ok(typeof prompt === 'string' || Array.isArray(prompt), 'prompt must be a string or array');
		assert.ok(typeCheck(parameters.completion, body), 'invalid body content');

		if (body.engine) {
			var engine = body.engine;
			delete body.engine;
		}

		return this._request(`/engines/${engine || this.engine}/completions`, {prompt, ...body})
		.then(res => res.data)
		.catch(err => {
			throw new RequestError(err.response.data.error);
		});
	}

	/**
	 * @typedef {Object} Search
	 * 
	 * @property {Number} document
	 * @property {String} object
	 * @property {Number} score
	 * @see https://beta.openai.com/docs/api-reference/searches
	 */

	/**
	 * @typedef {Object} SearchBody
	 * 
	 * @property {Array<String>} [documents] Up to 200 documents to search over, provided as a list of strings.
	 * @property {String} [file] The ID of an uploaded file that contains documents to search over.
	 * @property {Number} [max_rerank] The maximum number of documents to be re-ranked and returned by search.
	 * @property {Boolean} [return_metadata] A special boolean flag for showing metadata.
	 * @see https://beta.openai.com/docs/api-reference/searches
	 */

	/**
	 * Given a query and a set of documents or labels, the model ranks each document based on its semantic similarity to the provided query.
	 * @param {string|array} query
	 * @param {SearchBody} [body={}]
	 * @returns {Promise<Search>}
	 * @example
	 * const OpenAI = require('openai-nodejs');
	 * const client = new OpenAI('YOUR_API_KEY');
	 *
	 * const documents = ['Dancing', 'Programming', 'Skating', 'Drawing'];
	 *
	 * client.search('I do not like CSS', {documents})
	 * .then(result => {
	 *     var max_score = Math.max(...result.map(e => e.score), 0);
	 *
	 *     console.log(`Likely subject: ${documents[result.find(e => e.score === max_score).document]} (${max_score})`);
	 * })
	 * .catch(console.error);
	 * 
	 * @see https://beta.openai.com/docs/guides/search/create
	 */
	async search(query, body = {}) {
		assert.strictEqual(typeof query, 'string', 'query must be a string');
		assert.ok(typeCheck(parameters.search, body), 'invalid body content');

		if (body.engine) {
			var engine = body.engine;
			delete body.engine;
		}

		return this._request(`/engines/${engine || this.engine}/search`, {query, ...body})
		.then(res => res.data.data)
		.catch(err => {
			throw new RequestError(err.response.data.error);
		});
	}

	/**
	 * @typedef {Object} Classification
	 * 
	 * @property {String|Completion} completion
	 * @property {String} label
	 * @property {String} model
	 * @property {String} object
	 * @property {String} search_model
	 * @property {String} [prompt]
	 * @property {Array<ClassificationExample>} selected_examples
	 * @see https://beta.openai.com/docs/api-reference/classifications
	 */

	/**
	 * @typedef {Object} ClassificationBody
	 * 
	 * @property {Array<Array<String>>} [examples] A list of examples with labels.
	 * @property {String} [file] The ID of the uploaded file that contains training examples.
	 * @property {Array<String>} [labels] The set of categories being classified.
	 * @property {String} [search_model] ID of the engine to use for Search.
	 * @property {Number} [temperature] What sampling temperature to use.
	 * @property {Number} [logprobs] Include the log probabilities on the logprobs most likely tokens, as well the chosen tokens.
	 * @property {Number} [max_examples] The maximum number of examples to be ranked by Search when using file.
	 * @property {Object} [logit_bias] Modify the likelihood of specified tokens appearing in the completion.
	 * @property {Boolean} [return_prompt] If set to true, the returned JSON will include a "prompt" field containing the final prompt that was used to request a completion.
	 * @property {Boolean} [return_metadata] A special boolean flag for showing metadata.
	 * @property {Array<String>} [expand] If an object name is in the list, we provide the full information of the object; otherwise, we only provide the object ID.
	 * @see https://beta.openai.com/docs/api-reference/classifications
	 */

	/**
	 * @typedef {Object} ClassificationExample
	 * 
	 * @property {Number} document
	 * @property {String} label
	 * @property {String} text
	 * @see https://beta.openai.com/docs/api-reference/classifications
	 */

	/**
	 * [BETA] Classifies the specified query using provided examples.
	 * @param {string|array} query
	 * @param {ClassificationBody} [body={}]
	 * @returns {Promise<Classification>}
	 * @example
	 * const OpenAI = require('openai-nodejs');
	 * const client = new OpenAI('YOUR_API_KEY');
	 *
	 * const examples = [
	 *     ['A happy moment', 'Positive'],
	 *     ['I am sad.', 'Negative'],
	 *     ['I am feeling awesome', 'Positive']
	 * ];
	 * 
	 * const labels = ['Positive', 'Negative', 'Neutral'];
	 *
	 * client.classificate('It is a raining day :(', {examples, labels, 'search_model': 'ada', 'engine': 'curie'})
	 * .then(classification => {
	 *     console.log(`Classification: ${classification.label}`);
	 * })
	 * .catch(console.error);
	 * 
	 * @see https://beta.openai.com/docs/api-reference/classifications/create
	 */
	async classificate(query, body = {}) {
		assert.strictEqual(typeof query, 'string', 'query must be a string');
		assert.ok(typeCheck(parameters.classification, body), 'invalid body content');

		if (body.model) {
			var model = body.model;
			delete body.model;
		}

		return this._request(`/classifications`, {model: model || this.engine, query, ...body})
		.then(res => res.data)
		.catch(err => {
			throw new RequestError(err.response.data.error);
		});
	}

	/**
	 * @typedef {Object} Answer
	 * 
	 * @property {Array<String>} answers
	 * @property {String|Completion} completion
	 * @property {String} model
	 * @property {String} object
	 * @property {String} search_model
	 * @property {String} [prompt]
	 * @property {Array<AnswerDocument>} selected_documents
	 * @see https://beta.openai.com/docs/api-reference/answers
	 */

	/**
	 * @typedef {Object} AnswerBody
	 * 
	 * @property {Array<Array<String>>} examples List of (question, answer) pairs that will help steer the model towards the tone and answer format you'd like.
	 * @property {String} examples_context A text snippet containing the contextual information used to generate the answers for the examples you provide.
	 * @property {Array<String>} [documents] List of documents from which the answer for the input question should be derived.
	 * @property {String} [file] The ID of an uploaded file that contains documents to search over.
	 * @property {String} [search_model] ID of the engine to use for Search.
	 * @property {Boolean} [return_prompt] If set to true, the returned JSON will include a "prompt" field containing the final prompt that was used to request a completion.
	 * @property {Array<String>} [expand] If an object name is in the list, we provide the full information of the object; otherwise, we only provide the object ID.
	 * @property {Number} [max_rerank] The maximum number of documents to be ranked by Search when using file.
	 * @property {Boolean} [return_metadata] A special boolean flag for showing metadata.
	 * @property {Number} [max_tokens] The maximum number of tokens allowed for the generated answer.
	 * @property {Number} [temperature] What sampling temperature to use.
	 * @property {Number} [n] How many answers to generate for each question.
	 * @property {Number} [logprobs] Include the log probabilities on the logprobs most likely tokens, as well the chosen tokens.
	 * @property {String|Array<String>} [stop] Up to 4 sequences where the API will stop generating further tokens.
	 * @property {Object} [logit_bias] Modify the likelihood of specified tokens appearing in the completion.

	 * @see https://beta.openai.com/docs/api-reference/answers
	 */

	/**
	 * @typedef {Object} AnswerDocument
	 * 
	 * @property {Number} document
	 * @property {String} text
	 * @see https://beta.openai.com/docs/api-reference/answers
	 */

	/**
	 * [BETA] Answers the specified question using the provided documents and examples.
	 * @param {string|array} question
	 * @param {AnswerBody} [body={}]
	 * @returns {Promise<Answer>}
	 * @example
	 * const OpenAI = require('openai-nodejs');
	 * const client = new OpenAI('YOUR_API_KEY');
	 *
	 * const documents = ['Puppy A is happy.', 'Puppy B is sad.'];
	 * const examples_context = 'In 2017, U.S. life expectancy was 78.6 years.';
	 * const examples = [
	 *     ['What is human life expectancy in the United States?', '78 years.']
	 * ];
	 * 
	 * const stop = ['\n', '<|endoftext|>'];
	 *
	 * client.answer('Which puppy is happy?', {documents, examples_context, examples, stop})
	 * .then(answer => {
	 *     console.log(`Answer: ${answer.answers[0]}`);
	 * })
	 * .catch(console.error);
	 * 
	 * @see https://beta.openai.com/docs/api-reference/answers/create
	 */
	async answer(question, body = {}) {
		assert.strictEqual(typeof question, 'string', 'question must be a string');
		assert.ok(typeCheck(parameters.answer, body), 'invalid body content');

		if (body.model) {
			var model = body.model;
			delete body.model;
		}

		return this._request(`/answers`, {model: model || this.engine, question: question, ...body})
		.then(res => res.data)
		.catch(err => {
			throw new RequestError(err.response.data.error);
		});
	}

	/**
	 * @typedef {Object} File
	 * 
	 * @property {String} id
	 * @property {String} object
	 * @property {Number} bytes
	 * @property {Number|null} created_at
	 * @property {String} filename
	 * @property {String} purpose
	 * @property {String} status
	 * @property {String|null} status_details
	 * @see https://beta.openai.com/docs/api-reference/files
	 */

	/**
	 * Returns a list of files that belong to the user's organization.
	 * @returns {Promise<Array<File>>}
	 * @example
	 * const OpenAI = require('openai-nodejs');
	 * const client = new OpenAI('YOUR_API_KEY');
	 * 
	 * client.getFiles()
	 * .then(console.log)
	 * .catch(console.error);
	 * @see https://beta.openai.com/docs/api-reference/files/list
	 */
	async getFiles() {
		return this._request('/files', {}, 'GET')
		.then(res => res.data.data)
		.catch(err => {
			throw new RequestError(err.response.data.error);
		});
	}

	/**
	 * Returns information about a specific file.
	 * @param {String} filename
	 * @returns {Promise<File>}
	 * @example
	 * const OpenAI = require('openai-nodejs');
	 * const client = new OpenAI('YOUR_API_KEY');
	 * 
	 * client.getFile('FILE_ID')
	 * .then(console.log)
	 * .catch(console.error);
	 * @see https://beta.openai.com/docs/api-reference/files/retrieve
	 */
	async getFile(fileId) {
		assert.strictEqual(typeof fileId, 'string', 'fileId must be a string');

		return this._request('/files/' + fileId, {}, 'GET')
		.then(res => res.data)
		.catch(err => {
			throw new RequestError(err.response.data.error);
		});
	}

	/**
	 * @typedef {Object} DeletedFile
	 * 
	 * @property {String} id
	 * @property {String} object
	 * @property {Boolean} deleted
	 * @see https://beta.openai.com/docs/api-reference/files
	 */

	/**
	 * Delete a File.
	 * @param {String} fileId
	 * @returns {DeletedFile}
	 * @example
	 * const OpenAI = require('openai-nodejs');
	 * const client = new OpenAI('YOUR_API_KEY');
	 * 
	 * client.deleteFile('FILE_ID')
	 * .then(console.log)
	 * .catch(console.error);
	 * @see https://beta.openai.com/docs/api-reference/files/delete
	 */
	async deleteFile(fileId) {
		assert.strictEqual(typeof fileId, 'string', 'fileId must be a string');

		return this._request('/files/' + fileId, {}, 'DELETE')
		.then(res => res.data)
		.catch(err => {
			throw new RequestError(err.response.data.error);
		});
	}

	/**
	 * Upload a file that contains document(s) to be used across various endpoints/features.
	 * @param {string|ReadStream} file The content of the JSON to be uploaded.
	 * @param {String} purpose The intended purpose of the uploaded documents.
	 * @returns {File}
	 * @example
	 * const fs = require('fs');
	 * const OpenAI = require('openai-nodejs');
	 * const client = new OpenAI('YOUR_API_KEY');
	 * 
	 * client.uploadFile(fs.createReadStream('file.jsonl'), 'answers')
	 * .then(console.log)
	 * .catch(console.error);
	 * 
	 * client.uploadFile('{"text": "A text here"}', 'answers')
	 * .then(console.log)
	 * .catch(console.error);
	 * @see https://beta.openai.com/docs/api-reference/files/upload
	 */
	async uploadFile(file, purpose) {
		assert.ok(typeof file === 'string' || file instanceof stream.Readable, 'file must be a string or readableStream');
		assert.strictEqual(typeof purpose, 'string', 'purpose must be a string');
		assert.ok(purpose === 'search' || purpose === 'answers' || purpose === 'classifications', 'invalid purpose');

		if (typeof file === 'string') {
			let content = file;

			file = new stream.Readable();

			file.push(content);
			file.push(null);

			file.path = 'file.jsonl';
		}

		let data = new FormData();

		data.append('file', file);
		data.append('purpose', purpose);

		return this._request('/files', data, 'POST', data.getHeaders())
		.then(res => res.data)
		.catch(err => {
			throw new RequestError(err.response.data.error);
		});
	}

	/**
	 * Split text by keys.
	 * @param {String} text The string to be encoded
	 * @returns {Array<String>}
	 * @example
	 * const OpenAI = require('openai-nodejs');
	 * const client = new OpenAI('YOUR_API_KEY');
	 * 
	 * var encoded = client.encode('Hello, world!');
	 * console.log(encoded);
	 * @see https://beta.openai.com/docs/introduction/key-concepts
	 */
	encode(text) {
		assert.strictEqual(typeof text, 'string', 'text must be a string');

		return gpt3encoder.encode(text);
	}

	/**
	 * Decode keys to text.
	 * @param {Array<String>} text The encoded text
	 * @returns {string}
	 * @example
	 * const OpenAI = require('openai-nodejs');
	 * const client = new OpenAI('YOUR_API_KEY');
	 * 
	 * var encoded = client.encode('Hello, world!');
	 * var decoded = client.decode(encoded);
	 * console.log(`Decoded: ${decoded}`);
	 * @see https://beta.openai.com/docs/introduction/key-concepts
	 */
	decode(encoded_text) {
		assert.ok(Array.isArray(encoded_text), 'encoded_text must be an array');

		return gpt3encoder.decode(encoded_text);
	}

	/**
	 * Shows the token amount of the inserted text.
	 * @param {String} text The string to get the token amount
	 * @returns {Number}
	 * @example
	 * const OpenAI = require('openai-nodejs');
	 * const client = new OpenAI('YOUR_API_KEY');
	 * 
	 * var tokens = client.tokens('Hello, world!');
	 * console.log(`Tokens count: ${tokens}`);
	 * @see https://beta.openai.com/docs/introduction/key-concepts
	 */
	tokens(text) {
		assert.strictEqual(typeof text, 'string', 'text must be a string');

		return this.encode(text).length;
	}
}

module.exports = OpenAI;