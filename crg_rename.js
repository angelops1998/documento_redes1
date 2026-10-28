// Renombra la red de CEA a Crestline Group (CRG) en el Packet Tracer que ya está abierto.
// Uso: Extensions > Scripting > Edit File Script Module > Script Engine > Import, luego Run File.
// Cambia: nombre del router central (R-CEA -> R-CRG), hostname, banner de los 12 equipos,
// descripciones "a R-CEA" y el domain-name de los 8 pools DHCP (cea.local -> crg.local).
// No cambia contraseñas ni direccionamiento.

var PASS = "CeaRed2026"; // enable secret actual de los equipos (ver cea_build.js)
var BANNER = "banner motd #Acceso restringido - Crestline Group#";
var LOG = [];
function log(s) { LOG.push(s); try { dprint(s); } catch (e) {} }

var net = ipc.network();
function dev(name) { return net.getDevice(name); }

// Cada entrada es [equipo, comando]. "__PRIV__" deja la CLI en modo privilegiado.
var Q = [];
function cli(name, text) {
    Q.push([name, "__PRIV__"]);
    var cmds = text.split("\n");
    for (var i = 0; i < cmds.length; i++) Q.push([name, cmds[i].replace(/^\s+/, "")]);
    Q.push([name, "end"]);
    Q.push([name, "write memory"]);
    log("CLI encolada para " + name);
}

var ROUTERS = ["R-CEA", "R-NORTE", "R-SUR", "R-ESTE", "ISP"];
var SWITCHES = ["SW-CORE", "SW-A1", "SW-A2", "SW-A3", "SW-NORTE", "SW-SUR", "SW-ESTE"];
var POOLS = ["VLAN10_VENTAS", "VLAN20_OPERACIONES", "VLAN30_CAPACITACION", "VLAN40_ADMINISTRACION",
             "VLAN50_FINANZAS", "VLAN60_NORTE", "VLAN70_SUR", "VLAN80_ESTE"];

// 1. Renombrar el router central en el diagrama.
try {
    dev("R-CEA").setName("R-CRG");
    log("R-CEA renombrado a R-CRG");
} catch (e) { log("ERROR renombrando R-CEA: " + e); }

// 2. Configuración IOS.
var all = ROUTERS.concat(SWITCHES);
for (var i = 0; i < all.length; i++) {
    var n = all[i] === "R-CEA" ? "R-CRG" : all[i];
    var extra = "";
    if (n === "R-CRG") {
        extra = "hostname R-CRG\n";
        for (var p = 0; p < POOLS.length; p++) extra += "ip dhcp pool " + POOLS[p] + "\ndomain-name crg.local\nexit\n";
    }
    if (n === "SW-CORE") extra = "interface GigabitEthernet0/1\ndescription Troncal a R-CRG\nexit\n";
    if (n === "R-NORTE" || n === "R-SUR" || n === "R-ESTE") extra = "interface Serial0/0/0\ndescription WAN a R-CRG\nexit\n";
    cli(n, BANNER + "\n" + extra.replace(/\n$/, ""));
}

function runQueue(done) {
    var i = 0;
    function step() {
        if (i >= Q.length) { done(); return; }
        var it = Q[i++];
        var d = dev(it[0]);
        if (!d) { log("ERROR: no existe " + it[0]); setTimeout(step, 0); return; }
        var line = d.getCommandLine();
        var wait = 60;
        if (it[1] === "__PRIV__") {
            var pr = line.getPrompt();
            if (pr.indexOf("(config") >= 0) line.enterCommand("end");
            pr = line.getPrompt();
            if (pr.charAt(pr.length - 1) === ">") {
                line.enterCommand("enable");
                setTimeout(function () { line.enterCommand(PASS); setTimeout(function () { line.enterCommand("configure terminal"); setTimeout(step, 150); }, 150); }, 150);
                return;
            }
            line.enterCommand("configure terminal");
            wait = 150;
        } else {
            line.enterCommand(it[1]);
            if (it[1] === "write memory") wait = 800;
        }
        setTimeout(step, wait);
    }
    step();
}

runQueue(function () {
    log("Listo. Falta (a mano): en SRV-TI > Services > DNS cambiar los registros intranet.cea.local y archivos.cea.local por .crg.local, y luego File > Save As CRG_Red_Empresarial.pkt");
});
