# homebridge-EPSSecurity

A EPSecurity accessory for [Homebridge](https://github.com/nfarina/homebridge).

# Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-epssecurity`
3. Update your configuration file. See `sample-config.json` in this repository for a sample.

# Configuration

Sample configuration:

```
"accessories": [
    {
      "accessory": "EPSSecurity",
      "name": "Cuisine",
      "field_name": "CUISINE",
      "OAuthUser": "xxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "OAuthPwd": "xxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "login": "NNNNNNNN",
      "password": "XXXXXXXXX"
    }
]
```


---



---

**This plugin only acts as an interface between a web endpoint and Homebridge.** 
