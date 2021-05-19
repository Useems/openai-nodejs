class RequestError extends Error {
	constructor(err) {
		super(err.message);

		this.code = err.code;
		this.param = err.param;
		this.type = err.type;
	}
}

module.exports = RequestError;