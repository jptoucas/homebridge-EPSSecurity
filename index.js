var Service, Characteristic;
var cacheModule = require("cache-service-cache-module");
var cache = new cacheModule({ storage: "session", defaultExpiration: 60 });
var request = require("superagent");
var superagentCache = require("superagent-cache-plugin")(cache);

const DEF_MIN_TEMPERATURE = -100,
    DEF_MAX_TEMPERATURE = 100,
    DEF_TIMEOUT = 5000,
    DEF_INTERVAL = 3600000; //3600s

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-EPSSecurity", "EPSSecurity", EPSSecurity);
}

function EPSSecurity(log, config) {
    this.log = log;
    this.url = "https://www.eps-wap.fr/smartphone/Production/4.0/?/";
    this.name = config["name"];
    this.login = config["login"];
    this.password = config["password"];
    this.OAuthUser = config["OAuthUser"];
    this.OAuthPwd = config["OAuthPwd"];
    this.authorization = "Basic " + new Buffer(this.OAuthUser + ":" + this.OAuthPwd).toString("base64");
    this.log(`Auth: (${this.authorization})`);
    this.manufacturer = "EPS";
    this.model = "Birdie";
    this.SerialNumber = "1.0"
    this.fieldName = (config["field_name"] != null ? config["field_name"] : "temperature");
    this.timeout = config["timeout"] || DEF_TIMEOUT;
    this.minTemperature = config["min_temp"] || DEF_MIN_TEMPERATURE;
    this.maxTemperature = config["max_temp"] || DEF_MAX_TEMPERATURE;
    this.update_interval = Number(config["update_interval"] || DEF_INTERVAL);

    // Internal variables
    this.last_value = null;
    this.waiting_response = false;
}

EPSSecurity.prototype = {

    updateState: function () {
        //Ensure previous call finished
        if (this.waiting_response) {
            //this.log('Avoid updateState as previous response does not arrived yet');
            return;
        }
        this.waiting_response = true;
        this.last_value = new Promise((resolve, reject) => {

            var value = null;

            // First request
            request("GET", this.url + "check/10680661")
                .use(superagentCache)
                .expiration(this.cacheExpiration)
                .end(function (error, res, key) {
                    if (error) {
                        this.log(`HTTP Get failure (${this.url})`);
                    } else {
                        try {
                            this.Resultcheck = res.body.helios;
                            //this.log(`Resultat Check helios: (${this.Resultcheck})`);

                            // Second request : Get Session token
                            request("POST", this.url + "token")
                                .set("Content-Type", "application/x-www-form-urlencoded")
                                .set("Authorization", this.authorization)
                                .send({ grant_type: "client_credentials", scope: "PRODUCTION" })
                                .use(superagentCache)
                                .expiration(this.cacheExpiration)
                                .end(function (error, res, key) {
                                    if (error) {
                                        this.log(`HTTP post token failure (${this.url})`);
                                    } else {
                                        try {
                                            var firstKey = Object.keys(res.body)[0];
                                            objfirstKey = JSON.parse(firstKey);
                                            this.ResultGetToken = objfirstKey.access_token;
                                            //this.log(`Resultat ResultGetToken: (${this.ResultGetToken})`);

                                            request("POST", this.url + "connect")
                                                .set("Content-Type", "application/json")
                                                .set("Authorization", "Bearer " + this.ResultGetToken)
                                                .send({ "application": "SMARTPHONE", "login": this.login, "pwd": this.password, "typeDevice": "SMARTPHONE", "originSession": "EPS", "phoneType": "notAvailable", "codeLanguage": "fr_FR", "version": "4.6.2", "timestamp": "0", "system": "IOS12.2" })
                                                .use(superagentCache)
                                                .expiration(this.cacheExpiration)
                                                .end(function (error, res, key) {
                                                    if (error) {
                                                        this.log(`HTTP post connect failure url (${this.url})`);
                                                    } else {
                                                        try {
                                                            this.ResultIdSession = res.body.idSession;
                                                            //this.log(`Resultat ResultIdSession: (${this.ResultIdSession})`);

                                                            // Fourth request Get Temperature values
                                                            request("GET", this.url + "temperature/followup/last/" + this.ResultIdSession)
                                                                .set("Authorization", "Bearer " + this.ResultGetToken)
                                                                .use(superagentCache)
                                                                .expiration(this.cacheExpiration)
                                                                .end(function (error, res, key) {
                                                                    if (error) {
                                                                        this.log(`HTTP get connect failure url (${this.url})`);

                                                                    } else {
                                                                        try {
                                                                            var CurrentTemperature = res.body.statements.find(
                                                                                (it) => {
                                                                                    return it.label === this.fieldName;
                                                                                }
                                                                            );

                                                                            value = CurrentTemperature.temperature
                                                                            EpochDate = new Date(CurrentTemperature.date);
                                                                            strDate = EpochDate.toLocaleString('fr-FR', { timeZone: 'UTC' });

                                                                            this.log(`Resultat Temperature for: (${this.fieldName} : ${CurrentTemperature.temperature} (${strDate}))`);

                                                                            if (!error) {
                                                                                resolve(value);
                                                                            } else {
                                                                                reject(error);
                                                                            }
                                                                            this.waiting_response = false

                                                                        } catch (parseErr) {
                                                                            this.log('Error processing received information (GetTemperatures): ' + parseErr.message);
                                                                            error = parseErr;
                                                                        }
                                                                    }
                                                                }.bind(this));
                                                        } catch (parseErr) {
                                                            this.log('Error processing received information (Connect): ' + parseErr.message);
                                                            error = parseErr;
                                                        }
                                                    }
                                                }.bind(this));
                                        } catch (parseErr) {
                                            this.log('Error processing received information (GetToken): ' + parseErr.message);
                                            error = parseErr;
                                        }
                                    }
                                }.bind(this));
                        } catch (parseErr) {
                            this.log('Error processing received information (Check): ' + parseErr.message);
                            error = parseErr;
                        }
                    };
                }.bind(this));

        }).then((value) => {
            this.temperatureService
                .getCharacteristic(Characteristic.CurrentTemperature).updateValue(value, null);
            return value;
        }, (error) => {
            //For now, only to avoid the NodeJS warning about uncatched rejected promises
            return error;
        });
    },

    getState: function (callback) {
        //this.log('Call to getState: waiting_response is "' + this.waiting_response + '"');
        this.updateState(); //This sets the promise in last_value
        this.last_value.then((value) => {
            callback(null, value);
            return value;
        }, (error) => {
            callback(error, null);
            return error;
        });
    },

    getServices: function () {
        this.informationService = new Service.AccessoryInformation();
        this.informationService
            .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
            .setCharacteristic(Characteristic.Model, this.model)
            .setCharacteristic(Characteristic.SerialNumber, this.serial);

        this.temperatureService = new Service.TemperatureSensor(this.name);
        this.temperatureService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', this.getState.bind(this))
            .setProps({
                minValue: this.minTemperature,
                maxValue: this.maxTemperature
            });

        if (this.update_interval > 0) {
            this.timer = setInterval(this.updateState.bind(this), this.update_interval);
        }

        return [this.informationService, this.temperatureService];
    }
};