/*

TODO: Location of gamefield is absolute and very fragile
	Would be nicer to be set my HTML/CSS rather than wiggling around
	in JavaScript.

*/

// These are the major configuration options
var cols         = 6;   // Number of columns
var rows         = 8;   // Number of rows
var jewelScore   = 10;  // Score for a single jewel
var jewelTypes   = 8;   // Number of different types of "jewels"

// Constants
var empty = -1;         // representation of empty cell or invalid selection

// Internal variables
var currentScore = 0;   // Current game score

var selectedRow = empty;    // Currently selected (highlighted) row
var selectedCol = empty;    // Currently selected (highlighted) column
var posX = empty;           // Second selected (for swap) row
var posY = empty;           // Second selected (for swap) column

var jewels = new Array();   // All the jewels
var movingItems = 0;        // Number of jewels currently moving around
var gameState = "pick";     // Game state; initial state is picking a cell

/* Disabled, see below
var backgroundSound = 0;
document.addEventListener('visibilitychange', function(){
		backgroundSound.pause();
		if (!document.hidden) {
			backgroundSound.play();
		}
	},false);
*/

$(document).ready(function main() {
	// Delegate .transition() calls to .animate() if the browser can't do CSS transitions.
	if (!$.support.transition)
	  $.fn.transition = $.fn.animate;

    // Swipe and tap handler callbacks for interaction
    var swipeHandlers = {
        swipe:function(event, direction, distance, duration, fingerCount, fingerData) {
            handleSwipe($(event.target), direction);
        },
        tap:function(event, target) {
            handleTap($(target));
        }
    }

    // #mark Marker setup
    // Initialize the visual marker -- where the player taps...
    var marker = $('#marker');
    marker.hide(); // should be display: none in CSS already. Be safe.
    marker.swipe(swipeHandlers);
    marker.showAtCell = function(targetCell) {
        // Position the "marker" to show which cell we have selected.
        var marginLeft = parseInt(marker.css('margin-left'), 10);
        var marginTop = parseInt(marker.css('margin-top'), 10);
        marker.css({
            "top"    : (targetCell.position().top - marginTop) + "px",
            "left"   : (targetCell.position().left - marginLeft) + "px",
            "height" : gemSize + "px",
            "width"  : gemSize + "px"
        });
            
        marker.show();
    };
    
    // #mark Game Board setup
    // Initialize the game grid -- where the player plays...
    var gameGridId = 'gamefield';
    var gameGrid = $('#'+gameGridId);
    var gamePosition = gameGrid.offset();

    // Compute size of game grid (cellSize) and the gems inside them (gemSize)
    var cellSize = Math.floor((Math.min(gameGrid.width(), gameGrid.height())) / cols); 
    if (cellSize == 0) { // gameGrid.height() often fails in app-mode
        cellSize = Math.floor(gameGrid.width() / cols); 
    }
    var gemSize = cellSize - (parseInt(marker.css('margin-left'), 10) * 2);

    //alert("initialize: game= (" + gameRect.top + ", " + gameRect.left + "), "
    //            + "(" + gameRect.height + ", " + gameRect.width + ") "
    //            + "cellSize = " + cellSize + ", gemSize = " + gemSize);
        
    $(window).resize(function handleWindowResize() {
        //var isMobile = (/iPhone|iPod|iPad|Android|BlackBerry/).test(navigator.userAgent);
        var isMobile = (/iPhone|iPod|Android|BlackBerry/).test(navigator.userAgent);
        var isLandscape = (window.matchMedia("(orientation: landscape)")).matches;
        
        if (isMobile) {
            //if (isLandscape) {
            //    $('#landscape-error').show();
            //    gameGrid.hide();
            //} else {
            //    $('#landscape-error').hide();
            //    gameGrid.show();
            //}
            return;
        }
        
        // Compute size of game grid (cellSize) and the gems inside them (gemSize)        
        gamePosition = gameGrid.offset();
        cellSize = Math.floor((Math.min(gameGrid.width(), gameGrid.height())) / cols); 
        if (cellSize == 0) { // gameGrid.height() often fails in app-mode
            cellSize = Math.floor(gameGrid.width() / cols); 
        }
        gemSize = cellSize - (parseInt(marker.css('margin'), 10) * 2);

        //alert("resize: game= (" + gameRect.top + ", " + gameRect.left + "), "
        //    + "(" + gameRect.height + ", " + gameRect.width + ") "
        //    + "cellSize = " + cellSize + ", gemSize = " + gemSize);

        // Reposition all gems to their new locations
        for (i = 0; i < rows; i++) {
            for (j = 0; j < cols; j++) {
                repositionGem($("#gem_" + i +"_" + j), i, j);
            }
        }
        
        // TODO: Reposition marker as well.
        
    });
    
    // #mark Sound system initialization
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


    // #mark End initialization
    resetGame();
	//showPlayFor();

    // #mark Document Functions
    function resetGame() {
        currentScore = 0;
        saveScore(currentScore);
        
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
                    // The "system takes over" version
                    // The system tiles (jewltype7) are not selected in setup.
                    jewels[i][j] = Math.floor(Math.random() * (jewelTypes - 1));
                    //jewels[i][j] = Math.floor(Math.random() * jewelTypes);
                } while (isStreak(i, j));

                // Make and add the cell to the gamefield
                makeGem(i, j);
            }
        }
    }

    function repositionGem(gem, row, col) {
        gem.css({
            "top"    : (row * cellSize) + gamePosition.top + "px",
            "left"   : (col * cellSize) + gamePosition.left + "px",
            "height" : gemSize + "px",
            "width"  : gemSize + "px"
        });
    }

    function makeGem(row, col) {
        // Make and add the cell to the game grid
        var gemId = "gem_" + row +"_" + col;
        gameGrid.append('<div class="gem" id="' + gemId + '"></div>');
        
        gem = $('#' + gemId);
        gem.addClass('jeweltype' + jewels[row][col]);
        gem.swipe(swipeHandlers);        
        repositionGem(gem, row, col);
    }
    
    /*
    function getPosition(target) {
        var element = target[0];
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
    */

    function handleTap(target) {
        console.log('handleTap(' + target + ')');

        // If the marker gets selected (e.g. same cell tapped twice) unselect it.
		if (target.is(marker)) {
            marker.hide();			
			selectedRow = selectedCol = empty;
			return;
		}

 		if (gameState == "pick") { 		
 		    // Row and column are encoded in cell's id
 		    var targetId = target.attr('id').split('_');
            var targetRow = parseInt(targetId[1], 10);
            var targetCol = parseInt(targetId[2], 10);
 		    
            // TODO: Animate the selected cell?
            marker.showAtCell(target);

			if (selectedRow == empty) {		    // First cell selection
				selectSound.play();

				selectedRow = targetRow;
				selectedCol = targetCol;
			} else {			                // Second cell selection
			    posY = targetRow;
			    posX = targetCol;

				if ((Math.abs(selectedRow - posY) == 1 && selectedCol == posX) ||
				    (Math.abs(selectedCol - posX) == 1 && selectedRow == posY)) {
				    
                    marker.hide();
    				gameState = "switch";
					gemSwitch();
				} else {
					selectedRow = posY;
					selectedCol = posX;
				}
			}
		}
    }

    function handleSwipe(target, direction) {
        console.log('handleSwipe(' + target + ', ' + direction + ')');

		if (gameState == "pick") {
 		    // Row and column are encoded in cell's id
 		    var targetId = target.attr('id').split('_');
            posY = selectedRow = parseInt(targetId[1], 10);
   			posX = selectedCol = parseInt(targetId[2], 10);
 		    
            // TODO: Animate the selected cell?
            marker.showAtCell(target);
			selectSound.play();
			
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
                    marker.hide();
                    gameState = "switch";
                    gemSwitch();
                } else {
                    selectedRow = posY;
                    selectedCol = posX;
                }
            } else {
                // swiped out of bounds...
                errorSound.play();

                marker.hide();
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
						//var score = parseInt($("#score").text(), 10) + 10;
						currentScore += jewelScore;
						$("#score").text(currentScore);
						saveScore(currentScore);
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

    // #mark Game Over (work in progress)
    function checkHint() {
        var possibleMoves = [];
        for (i = 0; i < rows; i++) {
            for (j = 0; j < cols; j++) {
                //jewels[i][j] = empty;
                if (getPossibleMoves(i, j)) {
                    console.log('a move is possible');
                }
            }
        }
    }

    function getPossibleMove(row, col) {
        // Can make four possible moves
        // left (col - 1)
        if ((col - 1) >= 0) {
        }
        
        // right (col + 1)
        if ((col + 1) < cols) {
        }
        
        // up  (row - 1)
        if ((row - 1) >= 0) {
        }
        
        // down (row + 1)
        if ((row + 1) < rows) {
        }
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

function showAbout() {
	$("#about").dialog({
        position: { my: "top", at: "top+2%" },
        maxWidth: 480,
	    width: "90%",
	    modal: true,
	    buttons: {
            Ok: function() {
    	        window.scrollTo(0, 0);
                $('#about').dialog('close');
    	    }
        },
        create: function onCreateAbout() {
            $(".ui-dialog-titlebar").click(function (){
    	        window.scrollTo(0, 0);
                $('#about').dialog('close');
            });
        },
        close: function onCloseAbout() {
            // ensure we are at the top of the window or things get screwy
    	    window.scrollTo(0, 0);
        }
    });
}

function hidePlayFor() {
	$("#playfor").dialog('close');
}

function showPlayFor() {
	$("#playfor").dialog({
		//dialogClass: 'no-close',
        position: { my: "top", at: "top+2%" },
		draggable: false,
		modal: true,
        create: function onCreateAbout() {
            $(".ui-dialog-titlebar").click(function (){
                $('#playfor').dialog('close');
            })
        },
        close: function onClosePlayFor() {
            // ensure we are at the top of the window or things get screwy
    	    window.scrollTo(0, 0);
        }
	});
}

function showLeaderboard() {
    // Pull my high score
    var highScore = localStorage.highScore;
    if (highScore) {
        $('#myscores  .score').text(highScore);
    }
		    
    // Pull high scores from "server"
    $.ajax({
        url: 'hiscore.json',
        datatype: 'jsonp',
        success: function(data) {
            for (var team = 0; team < jewelTypes; team++) {
                var scoreSpan = $('#teamscores ' + '.jeweltype' + team + ' .score');
                
                //console.log(spanSelector + ': ' + team + ': ' 
                //    +  scoreSpan.text() + ' to ' + data[team]);

                scoreSpan.text(data[team]);
            }
            /* -- to sort the leaderboard
            var ul = $('ul#ulName'),
            li = ul.children('li');
    
            li.detach().sort(function(a,b) {
                return $(a).data('sortby') - $(b).data('sortby');  
            });
    
            ul.append(li);
            });
            */
            
        },
        error: function() {
        }
    });

	$("#leaderboard").dialog({
        position: { my: "top", at: "top+2%" },
        close: function onCloseHighScore() {
            // ensure we are at the top of the window or things get screwy
            window.scrollTo(0, 0);
        },
        create: function onCreateAbout() {
            $(".ui-dialog-titlebar").click(function (){
                $('#leaderboard').dialog('close');
            })
        },
        buttons: [{
            text: "Change Team",
            click: function() {
                $(this).dialog( "close" );
                showPlayFor();
            }
        }]
    });
}

function saveScore(score) {
    localStorage.lastScore = score;

    var highScore = localStorage.highScore;
    if (!highScore || score > highScore) {
        localStorage.highScore = score;
    }
}
