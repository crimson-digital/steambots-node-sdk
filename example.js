var SteamBots = require("./index");

var client = new SteamBots("[Your API Key]");

client.on("data", function(data) {
  console.log(data);
});

client.openStream();

client.loadInventory("76561197994468086")
.then(function(inventory) {
  console.log(inventory);
});
