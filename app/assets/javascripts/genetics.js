/*
  2016-1학기 인공지능
  정기철 교수님

  제출자
  20142579 황주비
  jubee0124@gmail.com

  유전알고리즘, 이미지 진화 시뮬레이션
  Genetics.js

  참고자료
  - https://rogeralsing.com/2008/12/07/genetic-programming-evolution-of-mona-lisa/
  - http://alteredqualia.com/visualization/evolve/

  캔버스렌더링 엔진 참조
  - https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D

  시뮬레이션 웹서버
  * https 지원안합니다
  - http://copythat-cloned-dobeeisfree.c9users.io/

*/
var Genetics = Genetics || {};
(function() {
  'use strict';
/*
  분석기능
*/
  var ap;
/*
  이미지 데이터
*/
  var workingCanvas; // 계산될 공간
  var workingCtx; // 계산될 이미지의 context
  var workingData = []; // 피트니스 펑션 계산을 해 객체의 염색체를 Compute

  var outputCanvas; // 결과가 그려질, 캔버스 공간
  var outputCtx; // CANVAS 에 그리기 대상이 되는 컨텍스트를 얻는다.

  var referenceCanvas;
  var referenceCtx;
  var referenceImage;
/*
  유전알고리즘
  변수 조절을 위한 GUI
*/
  var populationSize; // 50
  var selectionCutoff; // 15%
  var mutationChance; // 1.0%
  var mutateAmount; // 10%
  var fittestSurvive; // true or false
  var randomInheritance; // true or false
  var diffSquared; // true or false
/*
  그래픽 제어
*/
  var workingSize;
  var polygons; // 125
  var vertices; // 3
  var fillPolygons; // true or false

/*
  유전자 알고리즘 변수
  + 통계율
*/
  var clock;
  var jiffies; // numberOfGenerations
  var numberOfImprovements;
  var geneSize; // 4 + vertices * 2
  var dnaLength; // polygons * geneSize
  var lowestFitness;
  var highestFitness;
  var population;
  var startTime;
/*
  이미지 진화 시뮬레이션하기에
  캔버스렌더링을 위한 API가 제공되는지 검사한다.
*/
  var resumedTime = 0;
  function isSupported() {
    var isSupported = false;

    if (referenceCanvas.getContext &&
        referenceCanvas.getContext('2d').getImageData) {
      isSupported = true;
    }
    return isSupported;
  }
/*
  시간 통계를 위한 함수
*/
  function secondsToString(s) {
    var h = Math.floor(s / 3600);
    var m = Math.floor(s % 3600 / 60);

    s = Math.floor(s % 3600 % 60);

    return ((h > 0 ? h + ':' : '') +
            (m > 0 ? (h > 0 && m < 10 ? '0' : '') +
             m + ':' : '0:') + (s < 10 ? '0' : '') + s);
  }
/*
  염색체 표현
      상속받을 유전자가 있을 경우와 없을 경우로 나뉨
*/
  function Individual(mother, father) {
    this.dna = [];

    if (mother && father) {
      var inheritSplit = (Math.random() * dnaLength) >> 0;

      for (var i = 0; i<dnaLength; i+=geneSize) {
        var inheritedGene;// randomInheritance용

        if (randomInheritance) { // enabled
          inheritedGene = (i < inheritSplit) ? mother : father;
        }
        else { // not enabled
          inheritedGene = (Math.random() < 0.5) ? mother : father;
        }

        for (var j = 0; j < geneSize; j++) {
          /*
            지역변수 dna :: 상속된 유전자정보를 가지고 mutate 결정
          */
          var dna = inheritedGene[i + j];
          /*
            mutationChance
            높은 찬스는 쉬운 복제를.
          */
          if (Math.random() < mutationChance) {
            dna += Math.random() * mutateAmount * 2 - mutateAmount;
            /*
              유효범위 제한
            */
            if (dna < 0) dna = 0;
            if (dna > 1) dna = 1;
          }
          this.dna.push(dna);
        }
      } // for 종료
    }
    /*
      상속받을 부모가 없을 때
    */
    else {
      for (var g = 0; g < dnaLength; g += geneSize) {

        this.dna.push(Math.random(), // R
                      Math.random(), // G
                      Math.random(), // B
                      Math.max(Math.random() * Math.random(), 0.2)); // A

        var x = Math.random();
        var y = Math.random();

        for (var j = 0; j < vertices; j++) { // 꼭짓점 수 만큼
          this.dna.push(x + Math.random() - 0.5, // X
                        y + Math.random() - 0.5); // Y
        }
      }
    }
    // 계산되는 공간을 그린다
    this.draw(workingCtx, workingSize, workingSize);


    /*
        적합도 계산
    */
    var imageData = workingCtx.getImageData(0, 0,
                                            workingSize,
                                            workingSize).data;
    var diff = 0;
    if (diffSquared) { 
      /*
        급속도로 증가할 것인가?
        보다 큰 적합도를 반환한다.
      */ 
      for (var p = 0; p < workingSize * workingSize * 4; p++) {
        var dp = imageData[p] - workingData[p];
        diff += dp * dp;
      }
      /*
        4(RGBA), 256(컬러채널)
      */
      this.fitness = 1 - diff / (workingSize * workingSize * 4 * 256 * 256);
    }
    else { // 선형적이게 증가할거다
      for (var p = 0; p < workingSize * workingSize * 4; p++)
        diff += Math.abs(imageData[p] - workingData[p]);

      this.fitness = 1 - diff / (workingSize * workingSize * 4 * 256);
    }
  }
/*
  Individual를 그려주는 함수
*/
  Individual.prototype.draw = function(ctx, width, height) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    for (var g = 0; g < dnaLength; g += geneSize) {
      ctx.beginPath();
      ctx.moveTo(this.dna[g + 4] * width, this.dna[g + 5] * height);

      for (var i = 0; i < vertices - 1; i++) {
        ctx.lineTo(this.dna[g + i * 2 + 6] * width,
                   this.dna[g + i * 2 + 7] * height);
      }
      ctx.closePath();


      var styleString = 'rgba(' +
          ((this.dna[g] * 255) >> 0) + ',' + // R - int [0,255]
          ((this.dna[g + 1] * 255) >> 0) + ',' + // G - int [0,255]
          ((this.dna[g + 2] * 255) >> 0) + ',' + // B - int [0,255]
          this.dna[g + 3] + ')'; // A - float [0,1]

      if (fillPolygons)
      {
        ctx.fillStyle = styleString;
        ctx.fill();
      }
      else {
        ctx.lineWidth = 1;
        ctx.strokeStyle = styleString;
        ctx.stroke();
      }

    } //for문 종료
  };

/*
  (디폴트 사이즈는 50)
  사이즈만큼 해집단 생성
*/
  function Population(size) {
    this.individuals = [];
    for (var i = 0; i < size; i++)
      this.individuals.push(new Individual());
  }

/*
  다음 세대로 넘어가기위한 반복연산
*/
  Population.prototype.iterate = function() {

    if (this.individuals.length > 1) {
      var size = this.individuals.length; // 현재 염색체들 길이
      var offspring = []; // 자식배열 초기화

/*
  현재 세대에서 선택될 염색체들의 수,
  그들을 양만큼, 랜덤하게 자손을 만든다.
*/
      var selectCount = Math.floor(this.individuals.length * selectionCutoff); //15%
      var randCount = Math.ceil(1 / selectionCutoff); //15%

      this.individuals = this.individuals.sort(function(a, b) {
        return b.fitness - a.fitness; // 내림차순 정렬
      });

      if (fittestSurvive) randCount--;

      for (var i = 0; i < selectCount; i++)  {
        for (var j = 0; j < randCount; j++) {
          var randIndividual = i;

          while (randIndividual == i)
            randIndividual = (Math.random() * selectCount) >> 0;

          offspring.push(new Individual(this.individuals[i].dna,
                                        this.individuals[randIndividual].dna));
        }
      }
      /*
        염색체의 생명주기가 피트니스에 의해 결정됨
        피트니스가 큰 염색체들은 살아남게 됨
      */
      if (fittestSurvive) {
        this.individuals.length = selectCount;
        // 염색체에 자식 추가
        this.individuals = this.individuals.concat(offspring);
      }
      else {
        // 또는 자식으로 대체
        this.individuals = offspring;
      }
      this.individuals.length = size;
    }
    /*
      length가 1보다 작을 때
      무성생식으로
    */
    else {
      var parent = this.individuals[0];
      var child = new Individual(parent.dna, parent.dna);

      if (child.fitness > parent.fitness)
        this.individuals = [child]; //현재로 셋팅
    }
  };
/*
  염색체 객체 배열을 정렬해서 차이값을 리턴한다
  반환값은 fittest
*/
  Population.prototype.getFittest = function() {
    return this.individuals.sort(function(a, b) {
      /*
        내림차순으로 fitness를 숫자정렬
      */
      return b.fitness - a.fitness;
    })[0]; // 정렬된 값중, 최상위 fitness리턴
  };
/*
  버튼, 동작제어 함수
*/
  function isRunning() {
    return clock;
  }
  function isPaused() {
    return jiffies && !clock;
  }
  function isStopped() {
    return !isRunning() && !isPaused();
  }
/*
  드롭다운 이미지이름 선택 시
  이미지 설정해주는 함수
*/
  function setImage(src) {
    referenceImage.onload = prepareImage;
    referenceImage.src = src;
  }
/*
  이미지 셋팅
*/
  function prepareImage() {

    referenceCanvas.width = workingSize;
    referenceCanvas.height = workingSize;
    referenceCtx.drawImage(referenceImage,
                           0, 0, 350, 350,
                           0, 0, workingSize, workingSize);

    // 원시이미지 데이터를 뽑아와서
    var imageData = referenceCtx.getImageData(0, 0,
                                              workingSize,
                                              workingSize).data;
    // workingData에 담는다.
    workingData = [];
    var p = workingSize * workingSize * 4; // 4 = RGBA
    for (var i = 0; i < p; i++) //픽셀 단위로 담음
      workingData[i] = imageData[i];

    referenceCanvas.width = 350;
    referenceCanvas.height = 350;
    referenceCtx.drawImage(referenceImage, 0, 0);
    highestFitness = 0;
    lowestFitness = 100;
  }
/*
  GUI, 설정대로 변수를 담는 함수
*/
  function initConfiguration() {

    $('#population-size-slider').slider({
      range: 'min', min: 0, max: 100, step: 1,
      slide: function(event, ui) {
        $('#population-size').text(Math.max(1, ui.value));
      }
    });

    $('#cutoff-slider').slider({
      range: 'min', min: 1, max: 100, step: 1,
      slide: function(event, ui) {
        $('#cutoff').text(ui.value + '%');
      }
    });

    $('#mutation-chance-slider').slider({
      range: 'min', min: 0, max: 5, step: 0.1,
      slide: function(event, ui) {
        $('#mutation-chance').text(ui.value.toFixed(1) + '%');
      }
    });

    $('#mutation-amount-slider').slider({
      range: 'min', min: 0, max: 100, step: 1,
      slide: function(event, ui) {
        $('#mutation-amount').text(ui.value + '%');
      }
    });

    $('#polygons-slider').slider({
      range: 'min', min: 0, max: 500, step: 5,
      slide: function(event, ui) {
        $('#polygons').text(Math.max(1, ui.value));
      }
    });

    $('#vertices-slider').slider({
      range: 'min', min: 1, max: 30, step: 1,
      slide: function(event, ui) {
        $('#vertices').text(ui.value);
      }
    });

    $('#resolution-slider').slider({
      range: 'min', min: 0, max: 350, step: 5,
      slide: function(event, ui) {
        var resolution = Math.max(1, ui.value);
        $('#resolution').text(resolution + 'x' + resolution);
      }
    });
  }; // end of initConifguration

/*
  GUI
  디폴트값 셋팅
*/
  function setConfiguration(_populationSize,
                            _cutoffSlider,
                            _fittestSurvive,
                            _mutationChance,
                            _mutationAmount,
                            _polygons,
                            _vertices,
                            _resolution,
                            _fillPolygons,
                            _randomInheritance,
                            _diffSquared) {

    if (_populationSize === undefined)
      var _populationSize = 50;
    $('#population-size-slider').slider('value', _populationSize);
    $('#population-size').text(_populationSize);

    if (_cutoffSlider === undefined)
      var _cutoffSlider = 15;
    $('#cutoff-slider').slider('value', _cutoffSlider);
    $('#cutoff').text(_cutoffSlider + '%');

    if (_fittestSurvive === undefined)
      var _fittestSurvive = false;
    $('#fittest-survive').prop('checked', _fittestSurvive);

    if (_mutationChance === undefined)
      var _mutationChance = 1.0;
    $('#mutation-chance-slider').slider('value', _mutationChance);
    $('#mutation-chance').text(_mutationChance.toFixed(1) + '%');

    if (_mutationAmount === undefined)
      var _mutationAmount = 10;
    $('#mutation-amount-slider').slider('value', _mutationAmount);
    $('#mutation-amount').text(_mutationAmount + '%');

    if (_polygons === undefined)
      var _polygons = 125;
    $('#polygons-slider').slider('value', _polygons);
    $('#polygons').text(_polygons);

    if (_vertices === undefined)
      var _vertices = 3;
    $('#vertices-slider').slider('value', _vertices);
    $('#vertices').text(_vertices);

    if (_resolution === undefined)
      var _resolution = 75;
    $('#resolution-slider').slider('value', _resolution);
    $('#resolution').text(_resolution + 'x' + _resolution);

    if (_fillPolygons === undefined)
      var _fillPolygons = true;
    $('#fill-polygons').prop('checked', _fillPolygons);

    if (_randomInheritance === undefined)
      var _randomInheritance = false;
    $('#random-inheritance').prop('checked', _randomInheritance);

    if (_diffSquared === undefined)
      var _diffSquared = true;
    $('#diff-squared').prop('checked', _diffSquared);
  }
/*
  GUI
  사용자 설정 가져오기
*/
  function getConfiguration() {
    populationSize = parseInt($('#population-size').text());
    selectionCutoff = parseFloat($('#cutoff').text()) / 100;
    fittestSurvive = $('#fittest-survive')[0].checked;
    mutationChance = parseFloat($('#mutation-chance').text()) / 100;
    mutateAmount = parseFloat($('#mutation-amount').text()) / 100;
    polygons = parseInt($('#polygons').text());
    vertices = parseInt($('#vertices').text());
    workingSize = parseInt($('#resolution').text());
    fillPolygons = $('#fill-polygons')[0].checked;
    randomInheritance = $('#random-inheritance')[0].checked;
    diffSquared = $('#diff-squared')[0].checked;

    geneSize = (4 + vertices * 2);
    dnaLength = polygons * (4 + vertices * 2);

    workingCanvas.width = workingSize;
    workingCanvas.height = workingSize;
    workingCanvas.style.width = workingSize;
    workingCanvas.style.height = workingSize;
  }
/*
 * 실행
*/
  function runSimulation() {
    document.body.classList.remove('genetics-inactive');
    document.body.classList.add('genetics-active');

    if (isPaused()) startTime = new Date().getTime() - resumedTime;
    if (isStopped()) {

      jiffies = 0;
      numberOfImprovements = 0;
      startTime = new Date().getTime();
      population = new Population(populationSize);
    }
    /*
      시간단위로
      population를 진행하며,
      통계를 보여준다.
    */
    function tick() {
      population.iterate();
      jiffies++;
      /*
        내림차순으로 정렬된 fittest중 가상 최상위를 가져온다.
      */
      var fittest = population.getFittest();
      var totalTime = ((new Date().getTime() - startTime) / 1000);
      var timePerGeneration = (totalTime / jiffies) * 1000;
      var timePerImprovment = (totalTime / numberOfImprovements) * 1000;
      /*
        피트니스 통계를 위한 작업
      */
      var currentFitness = (fittest.fitness * 100);
      if (currentFitness > highestFitness) {
        highestFitness = currentFitness;
        numberOfImprovements++;
      }
      else if (currentFitness < lowestFitness) {
        lowestFitness = currentFitness;
      }
      // fittest를 결과 출력이미지에 그린다
      fittest.draw(outputCtx, 350, 350);
      /*
        실시간 통계상황
        toFixed(2) :: 소수 둘째 자리까지 표현
      */
      ap.elapsedTime.text(secondsToString(Math.round(totalTime)) + '초');
      ap.numberOfGenerations.text(jiffies);
      ap.timePerGeneration.text(timePerGeneration.toFixed(2) + ' ms');
      ap.timePerImprovment.text(timePerImprovment.toFixed(2) + ' ms');
      ap.currentFitness.text(currentFitness.toFixed(2) + '%');
      ap.highestFitness.text(highestFitness.toFixed(2) + '%');
      ap.lowestFitness.text(lowestFitness.toFixed(2) + '%');
    }
    clock = setInterval(tick, 0);
  } // end of runSimulation()

/*
 시작 버튼 함수
*/
  function startSimulation() {
    if (isStopped()) {
      getConfiguration();
      prepareImage();
    }
    $('.conf-slider').slider('option', 'disabled', true);
    $('input[type="checkbox"]').attr('disabled', true);
    $('#start').text('일시정지'); // 일시정지 버튼으로 바뀌고
    $('.results-btn').attr('disabled', 'disabled');
    /*
      시뮬레이션 실행
    */
    runSimulation();
  }
/*
 일시정지 버튼 함수
*/
  function pauseSimulation() {
    clearInterval(clock);
    clock = null;
    resumedTime = new Date().getTime() - startTime;
    $('#start').text('다시시작');
    $('.results-btn').removeAttr('disabled');
  }
/*
 정지 버튼 함수
*/
  function stopSimulation() {
    /*
      통계 변수 초기화
    */
    clearInterval(clock);
    clock = null;
    jiffies = null; // =numberOfGenerations
    startTime = null;
    population = null;
    highestFitness = 0;
    lowestFitness = 100;
    resumedTime = 0;

    $('#elapsed-time').text('0:00');
    $('.conf-slider').slider('option', 'disabled', false);
    $('input[type="checkbox"]').attr('disabled', false);
    $('.results-btn').attr('disabled', 'disabled');

    document.body.classList.remove('genetics-active');
    document.body.classList.add('genetics-inactive');

    //클리어
    outputCtx.clearRect(0, 0, 350, 350);
    workingCtx.clearRect(0, 0, workingSize, workingSize);

    $('#start').text('시작');
  }
/*
  이미지 드롭다운 제어
*/
  $('#stock-image-menu li a').click(function() {
    // 상대경로 지정
      setImage('/gimages/' + $(this).text() + '.jpg');
  });
/*
  실제 버튼 제어, 함수로 조작
*/
  $('#start').click(function() {
    if (isRunning()) {
      pauseSimulation();
    } else {
      startSimulation();
    }
  });

  $('#stop').click(function() {
    if (isRunning() || isPaused()) {
      stopSimulation();
    }
  });

  function configurationFromString(str) {
    var args = str.split('&');
    try {
      var _populationSize = parseInt(args[0]);
      var _cutoffSlider = parseInt(args[1]);
      var _fittestSurvive = (args[2]) ? true : false;
      var _mutationChance = parseFloat(args[3]);
      var _mutationAmount = parseInt(args[4]);
      var _polygons = parseInt(args[5]);
      var _vertices = parseInt(args[6]);
      var _resolution = parseInt(args[7]);
      var _fillPolygons = (args[8]) ? true : false;
      var _randomInheritance = (args[9]) ? true : false;
      var _diffSquared = (args[10]) ? true : false;

      setConfiguration(_populationSize,
                       _cutoffSlider,
                       _fittestSurvive,
                       _mutationChance,
                       _mutationAmount,
                       _polygons,
                       _vertices,
                       _resolution,
                       _fillPolygons,
                       _randomInheritance,
                       _diffSquared);
    } catch (e) {
    }
  }

  function configurationToString() {
    return populationSize + '&' +
        selectionCutoff * 100 + '&' +
        ((fittestSurvive) ? 1 : 0) + '&' +
        mutationChance * 100 + '&' +
        mutateAmount * 100 + '&' +
        polygons + '&' +
        vertices + '&' +
        workingSize + '&' +
        ((fillPolygons) ? 1 : 0) + '&' +
        ((randomInheritance) ? 1 : 0) + '&' +
        ((diffSquared) ? 1 : 0);
  }

/*
  window.onload될 초기화 함수
*/
  this.init = function() {

    outputCanvas = $('#outputCanvas')[0];
    outputCtx = outputCanvas.getContext('2d');

    workingCanvas = $('#workingCanvas')[0];
    workingCtx = workingCanvas.getContext('2d');

    referenceImage = $('#referenceImage')[0];
    referenceCanvas = $('#referenceCanvas')[0];
    referenceCtx = referenceCanvas.getContext('2d');
/*
    통계 설정
*/
    ap = {
      elapsedTime: $('#elapsed-time'),
      numberOfGenerations: $('#number-of-generations'),
      timePerGeneration: $('#time-per-generation'),
      timePerImprovment: $('#time-per-improvement'),
      currentFitness: $('#current-fitness'),
      highestFitness: $('#highest-fitness'),
      lowestFitness: $('#lowest-fitness')
    };

    if (!isSupported())
      alert('접근하지 못합니다');

/*
  차례대로 함수 실행
*/
    initConfiguration();
    setConfiguration();
    getConfiguration();
    prepareImage();

    $('.conf-option').tooltip('hide');
    $('#start').attr('disabled', false); // 버튼 풀기
    $('#stop').attr('disabled', false); // 조작할 수 있도록

    if (location.hash.split('&').length > 5)
      configurationFromString(location.hash.replace(/#/, ''));
  };
}).call(Genetics);
/*
  문서가 로드되고 난 후
  전역객체 Genetics 실행시킨다
*/
window.onload = Genetics.init;
