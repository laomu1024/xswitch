import { JSONC2JSON } from '../src/utils';

const parse = (jsonc: string): any => {
  try {
    return JSON.parse(JSONC2JSON(jsonc));
  } catch (e) {
    return 'parsed error';
  }
};

describe('parse', () => {
  test('parse pure JSON', () => {
    const jsonString = `{
  "proxy": [
    [
      "a.com",
      "b.com"
    ]
  ]
}`;

    expect(parse(jsonString)).toEqual({ proxy: [['a.com', 'b.com']] });
  });

  test('parse pure JSON with comma', () => {
    const jsonString = `{
  "proxy": [
    [
      "a.com",
      "b.com",
    ],,,,,
  ],
}`;

    expect(parse(jsonString)).toEqual({ proxy: [['a.com', 'b.com']] });
  });

  test('parse urls with ?? ,', () => {
    const jsonString = `{
  "proxy": [
    [
      "a.com??a.js,b.js",
      "b.com??a.js,b.js",
    ],
  ]
}`;

    expect(parse(jsonString)).toEqual({
      proxy: [['a.com??a.js,b.js', 'b.com??a.js,b.js']]
    });
  });

  test('parse urls with ?? with comments,', () => {
    const jsonString = `{
  "proxy": [
    [
      "a.com??a.js,b.js",
      // 
      "b.com??a.js,b.js",
    ],
  ]
}`;

    expect(parse(jsonString)).toEqual({
      proxy: [['a.com??a.js,b.js', 'b.com??a.js,b.js']]
    });
  });

  test('parse urls with ?? with comments,', () => {
    const jsonString = `{
  "proxy": [
    // jQuery
    [
      // jQuery
      "a.com??a.js,b.js",
      // 
      "b.com??a.js,b.js",
      // jQuery
    ],
    // jQuery
    [
      "jQuery",
      // jQuery
      ,"jQuery.min.js"
      // jQuery
    ]
  ]
}`;

    expect(parse(jsonString)).toEqual({
      proxy: [
        ['a.com??a.js,b.js', 'b.com??a.js,b.js'],
        ['jQuery', 'jQuery.min.js']
      ]
    });
  });

  test('parse reg rules', () => {
    const jsonString = `{
  "proxy": [
    [
      "(.*)a.com??a.js,b.js",
      "$1b.com??a.js,b.js",
    ],
  ]
}`;

    expect(parse(jsonString)).toEqual({
      proxy: [['(.*)a.com??a.js,b.js', '$1b.com??a.js,b.js']]
    });
  });

  test('parse headers rules with object values', () => {
    const jsonString = `{
  "headers": [
    ["https://api.example.com(/.*)?", { "X-Env": "local", "Authorization": "Bearer token 1" }],
  ],
}`;

    expect(parse(jsonString)).toEqual({
      headers: [
        ['https://api.example.com(/.*)?', { 'X-Env': 'local', 'Authorization': 'Bearer token 1' }]
      ]
    });
  });

  test('keeps commas and spaces inside strings', () => {
    const jsonString = `{
  "proxy": [["https://cdn.example.com/a,b c.js", "http://127.0.0.1:3000/a,b c.js"]]
}`;

    expect(parse(jsonString)).toEqual({
      proxy: [['https://cdn.example.com/a,b c.js', 'http://127.0.0.1:3000/a,b c.js']]
    });
  });
});
