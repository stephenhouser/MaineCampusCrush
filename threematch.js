/*

TODO: Location of gamefield is absolute and very fragile
	Would be nicer to be set my HTML/CSS rather than wiggling around
	in JavaScript.

*/

/* Disabled, see below
var backgroundSound = 0;
document.addEventListener('visibilitychange', function(){
		backgroundSound.pause();
		if (!document.hidden) {
			backgroundSound.play();
		}
	},false);
*/

$(document).ready(function() {
	//showPlayFor();

    // These are the major configuration options
	var cols        = 6;    // Number of columns
	var rows        = 8;    // Number of rows
  	var jewelTypes  = 8;    // Number of different types of "jewels"

    // Sounds, using howler.js (howlerjs.com)
	var clearSound = new Howl({urls: ['clear.wav']});
	var dropSound = new Howl({urls: ['drop.wav']});
	var selectSound = new Howl({urls: ['select.wav']});
	var errorSound = new Howl({urls: ['error.wav']});

	// Background sound.
	// Background sound is disabled because it is not working correctly.
	// Code above is designed to pause sound when the page is
	// not being displayed. It works, but only after switching away and
	// back to the page. That is, it does not pause the background sound
	// the first time you switch away, only the second, third, etc...
	/*
	backgroundSound = new Howl({
			urls: ['background.mp3'],
			autoplay: true,
			loop: true,
			volume: 0.25
		}).play();
	*/

    // Constant to represent an empty cell or invalid selection
    var empty = -1;

    // Figure out where the game field has been positioned on the screen.
    // Compute size of game grid (cellSize) and the gems inside them (gemSize)
    var gameRect = document.getElementById("gamefield").getBoundingClientRect();
    var cellSize = Math.floor((gameRect.width) / cols);
    var gemSize = cellSize - (parseInt($('#marker').css('margin'), 10) * 2);
    
    // Try to accomodate short phones by reducing the number of rows
    var gameOffset = $('#gamefield').offset();
    var winHeight = $(window).height();
    while (winHeight < (cellSize * rows) + gameOffset.top) {
        rows--;
    }

	// Delegate .transition() calls to .animate()
	// if the browser can't do CSS transitions.
	if (!$.support.transition)
	  $.fn.transition = $.fn.animate;

	var selectedRow = empty;
  	var selectedCol = empty;
  	var posX = empty;
  	var posY = empty;

  	var jewels = new Array(); // all the jewels
  	var movingItems = 0;
  	var gameState = "pick";   // initial game state is picking a cell

    // Swipe and tap handler callbacks for interaction
    var swipeHandlers = {
        swipe:function(event, direction, distance, duration, fingerCount, fingerData) {
            handleSwipe(event, event.changedTouches[0].target, direction);
        },
        tap:function(event, target) {
            handleTap(event, target);
        }
    }

    // Set up the selection marker
    var _markerId = 'marker';
    markerInit();

    // Initialize all cells to -1 (empty)
    // TODO: Do we need to pre-initialize all the cells this way?
  	for (i = 0; i < rows; i++) {
     	jewels[i] = new Array();
     	for (j = 0; j < cols; j++) {
          	jewels[i][j] = empty;
     	}
  	}

    // Fill all cells
	for (i = 0; i < rows; i++) {
		for (j = 0; j < cols; j++) {
		    // Fill cell with a random jewel that will NOT cause a "streak" (3-match)
			do {
				jewels[i][j] = Math.floor(Math.random() * jewelTypes);
			} while (isStreak(i, j));

            // Make and add the cell to the gamefield
            makeGem(i, j);
		}
	}

    $(window).resize(function() {
        //console.log('Resizing...');
        
        // Figure out where the game field has been positioned on the screen.
        // Compute size of game grid (cellSize) and the gems inside them (gemSize)
        gameRect = document.getElementById("gamefield").getBoundingClientRect();
        cellSize = Math.floor((gameRect.width) / cols);
        gemSize = cellSize - (parseInt($('#marker').css('margin'), 10) * 2);

        // Reposition all gems to their new locations
        for (i = 0; i < rows; i++) {
            for (j = 0; j < cols; j++) {
                var gemId = "gem_" + i +"_" + j;
                $('#' + gemId).css({
                    "top"    : (i * cellSize) + gameRect.top + "px",
                    "left"   : (j * cellSize) + gameRect.left + "px",
                    "height" : gemSize + "px",
                    "width"  : gemSize + "px"
                });
            }
        }
    });

    function makeGem(row, col) {
        // Make and add the cell to the gamefield
        var gemId = "gem_" + row +"_" + col;
        $("#gamefield").append('<div class="gem" id="' + gemId + '"></div>');
        $('#' + gemId).addClass('jeweltype' + jewels[row][col]).css({
            "top"    : (row * cellSize) + gameRect.top + "px",
            "left"   : (col * cellSize) + gameRect.left + "px",
            "height" : gemSize + "px",
            "width"  : gemSize + "px"
        });

        // Attach swipe and tap handlers
        $('#' + gemId).swipe(swipeHandlers);        
    }

    function markerInit() {
        $('#'+_markerId).swipe(swipeHandlers);
        markerHide(); // should be display: none in CSS already. Be safe.
    }

    function markerShow(x, y) {
        // Position the "marker" to show which cell we have selected.
        var borderLeftWidth = parseInt($('#'+_markerId).css('border-left-width'), 10);
        var marginLeft = parseInt($('#'+_markerId).css('margin-left'), 10);
        var borderTopWidth = parseInt($('#'+_markerId).css('border-top-width'), 10);
        var marginTop = parseInt($('#'+_markerId).css('margin-top'), 10);
        
        $('#'+_markerId).css({
            "top"    : (y - borderTopWidth - marginTop) + "px",
            "left"   : (x - borderLeftWidth - marginLeft) + "px",
            "height" : gemSize + "px",
            "width"  : gemSize + "px"
        });
            
        $('#'+_markerId).show();
    }
        
    function markerHide() {
        $('#'+_markerId).hide();
    }

    function isMarker(target) {
        return target == _markerId
    }

    function getPosition(element) {
        var xPosition = 0;
        var yPosition = 0;

        while (element) {
            xPosition += (element.offsetLeft - element.scrollLeft + element.clientLeft);
            yPosition += (element.offsetTop - element.scrollTop + element.clientTop);
            element = element.offsetParent;
			//console.log('position(' + xPosition + ', ' + yPosition + ')');
        }

        return { x: xPosition, y: yPosition };
    }

    function getCellIndex(position) {
		cellRow = Math.floor((position.y - gameRect.top) / cellSize);
		cellColumn = Math.floor((position.x - gameRect.left) / cellSize);

		//console.log('position(' + position.x + ', ' + position.y + ') --> ' +
		//            'cell(' + cellColumn + ', ' + cellRow + ')')

        return { col: cellColumn, row: cellRow };
    }


    function handleTap(event, target) {
        //console.log('handleTap(' + event + ', ' + target.id + ')');

        // If the marker gets selected (e.g. same cell tapped twice) unselect it.
		if (isMarker(target.id)) {
            markerHide();			
			selectedRow = selectedCol = empty;
			return;
		}

 		if (gameState == "pick") {
 		    var position = getPosition(target);
			var selectedCell = getCellIndex(position);

            //console.log('selectedCell (' + selectedCell.col + ', ' + selectedCell.row + ')');

            // TODO: Animate the selected cell?
            markerShow(position.x, position.y);

			if (selectedRow == empty) {		    // First cell selection
				selectSound.play();

				selectedRow = selectedCell.row;
				selectedCol = selectedCell.col;
			} else {			                // Second cell selection
			    posY = selectedCell.row;
			    posX = selectedCell.col;

				if ((Math.abs(selectedRow - posY) == 1 && selectedCol == posX) ||
				    (Math.abs(selectedCol - posX) == 1 && selectedRow == posY)) {
                    markerHide();
    				gameState = "switch";
					gemSwitch();
				} else {
					selectedRow = posY;
					selectedCol = posX;
				}
			}
		}
    }

    function handleSwipe(event, target, direction) {
        //console.log('handleSwipe(' + event + ', ' + target + ', ' + direction + ')');

		if (gameState == "pick") {
		    var position = getPosition(target);
			posY = position.y;
			posX = position.x;

            markerShow(position.x, position.y);

			selectSound.play();
			posY = selectedRow = Math.floor( (posY - gameRect.top) / cellSize);
			posX = selectedCol = Math.floor( (posX - gameRect.left) / cellSize);

            var trySwitch = false;
            switch (direction) {
                case "up":
                    if (selectedRow > 0) {
                        posY = selectedRow - 1;
                        trySwitch = true;
                    }
                    break;
                case "down":
                    if (selectedRow < rows - 1 ) {
                        posY = selectedRow + 1;
                        trySwitch = true;
                    }
                    break;
                case "left":
                    if (selectedCol > 0) {
                        posX = selectedCol - 1;
                        trySwitch = true;
                    }
                    break;
                case "right":
                    if (selectedCol < cols - 1) {
                        posX = selectedCol + 1;
                        trySwitch = true;
                    }
                    break;
            }

            if (trySwitch) {
                if((Math.abs(selectedRow - posY) == 1 && selectedCol == posX) ||
                   (Math.abs(selectedCol - posX) == 1 && selectedRow == posY)) {
                    markerHide();
                    gameState = "switch";
                    gemSwitch();
                } else {
                    selectedRow = posY;
                    selectedCol = posX;
                }
            } else {
                // swiped out of bounds...
                errorSound.play();

                markerHide();
                posY = selectedRow = empty;
                posX = selectedCol = empty;
            }
		}
    }

	function checkMoving() {
		movingItems--;

        if (movingItems == 0) {
            switch(gameState) {
                case "revert":
                case "switch":
                    if (!isStreak(selectedRow, selectedCol) && !isStreak(posY, posX)) {
                        if (gameState != "revert") {
                            errorSound.play();
                            gameState = "revert";
                            gemSwitch();
                        } else {
                            gameState = "pick";
                            selectedRow = empty;
                        }
                    } else {
                        gameState="remove";
                        if (isStreak(selectedRow, selectedCol)) {
                            removeGems(selectedRow, selectedCol);
                        }

                        if (isStreak(posY, posX)) {
                            removeGems(posY, posX);
                        }

                    gemFade();
                }
                break;

            case "remove":
                checkFalling();
                break;

            case "refill":
                placeNewGems();
                break;
            }
        }
	}

	function placeNewGems() {
		var gemsPlaced = 0;

		for (i = 0; i < cols; i++) {
			if (jewels[0][i] == empty) {
				jewels[0][i] = Math.floor(Math.random() * jewelTypes);
                makeGem(0, i);
          		gemsPlaced++;
				dropSound.play();
			}
		}

		if (gemsPlaced) {
			gameState = "remove";
			checkFalling();
		} else {
			var combo = 0
			for (i = 0; i < rows; i++) {
      			for (j = 0; j < cols; j++){
      				if (j <= (cols - 3) &&
      				    jewels[i][j] == jewels[i][j+1] && jewels[i][j] == jewels[i][j+2]) {
						combo++;
						removeGems(i, j);
					}
					if (i <= (rows-3) &&
					    jewels[i][j] == jewels[i+1][j] && jewels[i][j] == jewels[i+2][j]) {
						combo++;
						removeGems(i, j);
					}
				}
			}

			if (combo > 0){
				gameState = "remove";
				gemFade();
			} else {
				gameState = "pick";
				selectedRow = empty;
			}
		}
	}

	function checkFalling(){
		var fellDown = 0;

		for (j = 0; j < cols; j++){
			for (i = (rows-1); i > 0; i--) {
				if (jewels[i][j] == empty && jewels[i-1][j] >= 0) {
					$("#gem_"+(i-1)+"_"+j).addClass("fall").attr("id","gem_"+i+"_"+j);
					jewels[i][j] = jewels[i-1][j];
					jewels[i-1][j] = empty;
					fellDown++;
				}
			}
		}

		$.each($(".fall"), function() {
			movingItems++;
			$(this).transition({ top: "+=" + cellSize }, {
			        duration: 150,
                    complete: function() {
                        $(this).removeClass("fall");
                        checkMoving();
				}
			});
		});

		if (fellDown == 0) {
			gameState = "refill";
			movingItems = 1;
			checkMoving();
		}
	}

	function gemFade() {
		$.each($(".remove"), function() {
			clearSound.play();
			movingItems++;
			$(this)
				.transition({ scale: 1.25 }, { duration: 100 })
				.transition({ opacity:0, scale: 0.1 }, {
					duration: 150,
					complete: function() {
						$(this).remove();
						checkMoving();

						// Update score
						var score = parseInt($("#score").text(), 10);
						$("#score").text(score+10);
					}
			});
		});
	}

	function gemSwitch() {
		var yOffset = selectedRow - posY;
		var xOffset = selectedCol - posX;

		// First the animation...
		$("#gem_" + selectedRow + "_" + selectedCol).addClass("switch").attr("dir", "-1");
		$("#gem_" + posY + "_" + posX).addClass("switch").attr("dir", "1");
		$.each($(".switch"), function() {
			movingItems++;
			$(this).transition( {
                    left: "+=" + xOffset * cellSize * $(this).attr("dir"),
                    top : "+=" + yOffset * cellSize * $(this).attr("dir")
			    }, {
                    duration: 150,
                    complete: function() {
                        checkMoving();
    				}
			    }
			).removeClass("switch")
		});

        // ...then the view update
		$("#gem_" + selectedRow + "_" + selectedCol).attr("id", "temp");
		$("#gem_" + posY + "_" + posX).attr("id","gem_" + selectedRow + "_" + selectedCol);
		$("#temp").attr("id", "gem_" + posY + "_" + posX);

		// ...and here's the model switch
		var temp = jewels[selectedRow][selectedCol];
		jewels[selectedRow][selectedCol] = jewels[posY][posX];
		jewels[posY][posX] = temp;
	}

	function removeGems(row, col) {
		var gemValue = jewels[row][col];
		var tmp = row;
		$("#gem_" + row + "_" + col).addClass("remove");

		if (isVerticalStreak(row, col)){
			while (tmp > 0 && jewels[tmp-1][col] == gemValue) {
				$("#gem_" + (tmp-1) + "_" + col).addClass("remove");
				jewels[tmp-1][col] = empty;
				tmp--;
			}

			tmp = row;
			while (tmp < (rows-1) && jewels[tmp+1][col] == gemValue) {
				$("#gem_" + (tmp+1) + "_" + col).addClass("remove");
				jewels[tmp+1][col] = empty;
				tmp++;
			}
		}

		if (isHorizontalStreak(row, col)) {
			tmp = col;
			while (tmp > 0 && jewels[row][tmp-1] == gemValue){
				$("#gem_" + row + "_" + (tmp-1)).addClass("remove");
				jewels[row][tmp-1] = empty;
				tmp--;
			}

			tmp = col;
			while (tmp < (cols-1) && jewels[row][tmp+1] == gemValue) {
				$("#gem_" + row + "_" + (tmp+1)).addClass("remove");
				jewels[row][tmp+1] = empty;
				tmp++;
			}
		}

		jewels[row][col] = empty;
	}

	function isVerticalStreak(row, col) {
		var gemValue = jewels[row][col];
		var streak = 0;

		var tmp = row;
		while (tmp > 0 && jewels[tmp-1][col] == gemValue) {
			streak++;
			tmp--;
		}

		tmp = row;
		while (tmp < (rows-1) && jewels[tmp+1][col] == gemValue) {
			streak++;
			tmp++;
		}

		return streak > 1;
	}

	function isHorizontalStreak(row, col) {
		var gemValue = jewels[row][col];
		var streak = 0;

		var tmp = col;
		while (tmp > 0 && jewels[row][tmp-1] == gemValue) {
			streak++;
			tmp--;
		}

		tmp = col;
		while (tmp < (cols-1) && jewels[row][tmp+1] == gemValue) {
			streak++;
			tmp++;
		}

		return streak > 1;
	}

	function isStreak(row, col) {
	 	return isVerticalStreak(row, col) || isHorizontalStreak(row, col);
	}
});

function hideAbout() {
	$("#about").dialog('close');
}

function showAbout() {
	$("#about").dialog({ width: "90%", });
}

function hidePlayFor() {
	$("#playfor").dialog('close');
}

function showPlayFor() {
	$("#playfor").dialog({
		dialogClass: 'no-close',
		draggable: false,
		modal: true
	});
}

