const OpenAI = require('../../src');

describe('Tokens Amount', () => {
    let client = new OpenAI('UNKNOW');

    it('should returns the amount of tokens from the text "Hello, world!" as 4', () => {
        let tokens = client.tokens('Hello, world!');

        expect(tokens).toBe(4);
    });

    it('should returns the amount of tokens from the text "My name is Fulano" as 5', () => {
        let tokens = client.tokens('My name is Fulano');

        expect(tokens).toBe(5);
    });

    it('should returns the amount of tokens from the text "One plus one equals two" as 5', () => {
        let tokens = client.tokens('One plus one equals two');

        expect(tokens).toBe(5);
    });
});