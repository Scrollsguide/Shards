var Scrolls = [];
var commons = [];
var uncommons = [];
var rares = [];
var main;
var totalRows = 0;
var isSaving = false;
var picks = [];
var deck = []
var visibleRows = 4;
var deckName = "Judgement " + Math.random().toString(36).substring(2, 7); // before seeding the scroll selection
var game;

var StandardGame = function(){
	this.rows = 45;
	this.pickHeight = 390;
	
	this.getRow = function(rowNum){
		var row_div = $('<div/>', {
			class:"rowcontainer"
		});

		for (var i = 0; i < 4; i++) { // 4 cards in a row
			var rarity = Math.random(); //Generate random number to balance rarity

			if (rarity < 0.7){  // 70% chance to get a common
				var currScroll = commons[Math.floor(Math.random()*commons.length)];
			} else if (rarity < 0.9){ // 20% chance to get an uncommon
				var currScroll = uncommons[Math.floor(Math.random()*uncommons.length)];
			} else { // 10% chance to get a rare
				var currScroll = rares[Math.floor(Math.random()*rares.length)];
			}

			row_div.append(makeDiv(currScroll));
		}
		
		return row_div;
	}
}

var ImprovedGame = function(){
	this.rows = 50;
	this.pickHeight = 520;
	
	this.getRow = function(rowNum){
		var uniques;
		switch (rowNum % 10){
			case 0: // rares
				uniques = pickUniquesFrom(rares, 4);
			break;
			case 4: // uncommons
			case 7:
				uniques = pickUniquesFrom(uncommons, 4);
			break;
			default: // commons
				uniques = pickUniquesFrom(commons, 4);
			break;
		}
		
		var row_div = $('<div/>', {
			class:"rowcontainer"
		});
		for (var i = 0; i < uniques.length; i++) {
			row_div.append(makeDiv(uniques[i]));
		}
		
		return row_div;
	}
}

var pickUniquesFrom = function(source, count){
	var result = [];
	for (var i = 0; i < count; i++){
		var p;
		do {
			// ah this is kinda ugly
			p = source[Math.floor(Math.random() * source.length)];
		} while (scrollInArray(p, result));
		result.push(p);
	}
	
	return result;
}

var scrollInArray = function(needle, haystack){
	for (var i = 0; i < haystack.length; i++){
		if (haystack[i].id == needle.id){
			return true;
		}
	}
	return false;
}

$(document).ready(function(){
	main = $('#scrolldump');
	
	$("input[name='seed']").val(Math.random().toString(36).substring(2, 7));
	
	$("#start").click(function(){
		$(this).css("display", "none");
		var gameType = parseInt($("select[name='gametype']").val());
		
		if (gameType == 2){
			game = new ImprovedGame();		
		} else {
			game = new StandardGame();
		}
		main.css("height", game.pickHeight);
		
		$("#drawswrapper").slideDown(300);
		main.html("Loading scrolls...");
		
		$("#right_wrap").children().each(function(){
			$(this).slideUp(500, function(){
				$(this).remove();
			});
		});
		$("#right_wrap").append($("<div/>", {
			id: "hoverbox",
			class: "block",
			html: "<div class='blockheader'>Scroll</div><div class='subblock'></div>"
		})).append($("<div/>", {
			id: "pickbox",
			class: "block",
			html: "<div class='blockheader'>Picks</div><div class='subblock' id='picks'></div>"
		}));
		
		var seed = $("input[name='seed']").val();
		Math.seedrandom(seed);
		
		start();
	});
	
	$(".scrollcontainer").live('mouseenter', function(){
		infobox($(this).attr("data-scroll-id"));
	});
	$(".pickedrow").live('mouseenter', function(){
		infobox($(this).attr("data-scroll-id"));
	});
	
	$("#sendtodeckbuilder").click(function(){
		$(this).html("Saving...");
		exportDeck();
	});
});

var Scroll = function(s, cost, faction) {

	this.s = s;
	this.id = s.id;	
	this.img_id = s.image;
	this.name = s.name;
	this.rarity = s.rarity;
	this.cost = cost;
	this.faction = faction;
	this.kind = s.kind;

	this.setName = function(newName){
		this.name = newName;
	}
}

function start(){
	$.getJSON('http://a.scrollsguide.com/scrolls', function(data){
		$.each(data.data, function(index, val){
			var currScroll = data.data[index];

			var scr;
			if (currScroll.costgrowth > 0){
				scr = new Scroll(currScroll, currScroll.costgrowth, 'Growth');
			} else if(currScroll.costorder > 0){
				scr = new Scroll(currScroll, currScroll.costorder, 'Order');
			} else if(currScroll.costenergy > 0){
				scr = new Scroll(currScroll, currScroll.costenergy, 'Energy');
			} else {
				scr = new Scroll(currScroll, currScroll.costdecay, 'Decay');
			}
			
			Scrolls.push(scr);
	
			switch (scr.rarity){
				case 0:
					commons.push(scr);
				break;
				case 1:
					uncommons.push(scr);
				break;
				default:
					rares.push(scr);
				break;
			}			
		});

		updateCount();
		addRows();
		setClickable();
	});
}

function addRows(){ 
	$('#scrolldump').empty();

	totalRows++; //Increase row count

	for (var x = 0; x < game.rows; x++) {
		var row_div = game.getRow(x);

		$('#scrolldump').append(row_div); //Container div for the whole moving thing
	}
	
	$(".scrollcontainer").click(function(event){
		if ($(this).parent(".rowcontainer").hasClass('clickable')){ // Is actually clickable
			if (picks.length < game.rows){
				$(this).parent(".rowcontainer").removeClass("clickable"); //To prevent multiple clicks on the same row

				if (!$("#pickbox").is(":visible")){
					$("#pickbox").slideDown(300);
				}
				var s = getScrollById($(this).attr("data-scroll-id")); // Getting scroll from ID from scrollcontainer class

				pick(s);

				$(this).parents(".rowcontainer").slideToggle(200, function(){
					$(this).remove();
					setClickable();
				});
				
				if (picks.length == game.rows){ // all done
					$("#drawswrapper").slideUp(300);
					prepareDeck();
					updatePickDiv();
					$("#yourpicks").slideDown(300);
				}
			}
		}
	});
}

var makeDiv = function(scroll){
	var currResource 	= scroll.faction.toLowerCase();

	var $scroll_div 	= $('<div/>', {
		class: "scrollcontainer",
		"data-scroll-id": scroll.id
	});
	
	var $scroll_name 			= $('<div/>', {class: "scrollname blacktextshadow", html: scroll.name});
	var $img 					= $('<img/>', {class: "scrollimg", src: "/app/low_res/" + scroll.img_id + ".png"});
	var $resource 				= $('<div/>', {class: "resourceicon"});
	var $resource_text 			= $('<div/>', {class: "blacktextshadow", html: scroll.cost});
	var $resource_icon			= $('<img/>', {src: "/deckbuilder/img/" + currResource + ".png"});

	$resource.append($resource_text).append($resource_icon);
	$scroll_div.append($img).append($scroll_name).append($resource);
	
	return $scroll_div;
}

var prepareDeck = function(){
	// make deck from picks
	for (var i = 0; i < picks.length; i++){
		var scroll = picks[i];
		// add scroll to deck
		var inDeck = false;
		for (var j = 0; j < deck.length; j++){
			if (deck[j].id == scroll.id && !inDeck){
				// scroll already exists in deck, increase count
				inDeck = true;
				deck[j].count++;
				break;
			}
		}
		if (!inDeck){
			// scroll is not in deck yet, set count to 1
			deck.push({ id: scroll.id, count: 1 });
		}
	}
}

var updatePickDiv = function(){
	var deckSlider = $("#deckslider");
	
	for (var i = 0; i < deck.length; i++){
		var d = makeDiv(getScrollById(deck[i].id));
		
		// heh heh redneck
		var r = d.find(".resourceicon");
		r.find("img").remove();
		r.find("div").html(deck[i].count + "x");
		
		deckSlider.append(d);
	}
}

var pick = function(scroll){
	picks.push(scroll);
	$('#picks').append($("<div/>", {
		class: "pickedrow",
		html: scroll.name,
		"data-scroll-id": scroll.id
	}));
	updateCount();
}

function setClickable() {
	$(".rowcontainer").first().addClass('clickable').animate({ opacity: 1 }, 200);
}

function updateCount(count) {
	$("#pickbox .blockheader").html("Picks: " + picks.length + "/" + game.rows);
}

function exportDeck() {
	if (isSaving){
		return;
	}
	isSaving = true;

	var out = [];
	var doubles = 0;
	var columns = Math.floor(($(window).width() - 460) / 150);

	for (var i = 0; i < deck.length; i++){
		
		var scroll = deck[i];
		
		var dbZ = 10;
		
		for (var j = 0; j < scroll.count; j++) {
			if (j > 0){
				doubles ++;
			}
			dbX = 250 + ((out.length - doubles) % columns) * 150; // 250 = start, 150 = image width and some padding //pos
			dbY = 60 + Math.floor((out.length - doubles) / columns) * 150 - (15 * j); //pos
			dbZ--; //pos
			
			var outObj = {
				"id":	scroll.id,
				"x":	dbX,
				"y":	dbY,
				"z":	dbZ
			};
			
			out.push(outObj);
		}
	}

	$.post("/deckbuilder/p/savedeck.php", { name: deckName, scrolls: out }, 
		function(output){
			isSaving = false;
			var url = "http://www.scrollsguide.com/deckbuilder/?d=" + output; 
			$("#stdbwrap").html("<a href='http://www.scrollsguide.com/deckbuilder/#" + output + "' target='_blank'>Click here to view your deck</a>");
			// window.location.href = "http://www.scrollsguide.com/deckbuilder/?d=" + output;
	});
}

function infobox(id){
	var hoverBox = $("#hoverbox");
	var scroll = getScrollById(id);
	
	hoverBox.find(".blockheader").html(scroll.name);
	
	hoverBox.find(".subblock").html("<div style='font-style: italic;margin-bottom: 5px;text-align: center;'>" + caps(scroll.kind) + ": " + scroll.cost + " " + scroll.faction + "</div>")
	.append("<div>" + scroll.s.description + "</div>");
}

function getScrollById(id){
	for (var i = 0; i < Scrolls.length; i++){
		if (Scrolls[i].id == id){
			return Scrolls[i];
		}
	}
	return false;
}

function caps(inp){
    return inp.charAt(0).toUpperCase() + inp.slice(1).toLowerCase();
}