/**
 * Angular reservation module
 * @author hmartos
 */
(function() {
	//Module definition with dependencies
	angular.module('hm.reservation', ['ui.bootstrap', 'pascalprecht.translate', 'ngMessages']);

})();
/**
 * Provider for reservation module
 * @author hmartos
 */
(function() {
    angular.module('hm.reservation').provider('reservationConfig', [reservationConfigProvider]);

    function reservationConfigProvider() {

        var config = {
            getDetailsUrl: "http://localhost:8080/getDetails",
            getAvailableHoursAPIUrl: "http://localhost:8080/availableHours", //API url endpoint to load list of available hours
            holdSlotAPIUrl: "http://localhost:8080/hold", //API url endpoint to do a hold
            reserveAPIUrl: "http://localhost:8080/reserve", //API url endpoint to do a reserve
            dateFormat: "yyyy-MM-dd",
            language: "en",
            showConfirmationModal: true,
            datepickerTemplate: "datepicker.html",
            availableHoursTemplate: "availableHours.html",
            noAvailableHoursTemplate: "noAvailableHours.html",
            clientFormTemplate: "clientForm.html",
            confirmationModalTemplate: "confirmationModal.html",
        };

        //Public API for the provider
        return ({
            $get: function() {
                return config;
            },
            set: function (values) {
                angular.extend(config, values);
            }
        });

    }
})();
/**
 * Controller for directive
 * @author hmartos
 */
(function () {
    //Controller
    angular.module('hm.reservation').controller('ReservationCtrl', ['$scope', '$rootScope', '$filter', '$translate', 'reservationAPIFactory', 'reservationConfig', 'reservationService', 'Order', 'PaymentMethod', reservationCtrl]);

    function reservationCtrl($scope, $rootScope, $filter, $translate, reservationAPIFactory, reservationConfig, reservationService, Order, PaymentMethod) {
        //Capture the this context of the Controller using vm, standing for viewModel
        var vm = this;

        vm.selectedTab = 0;
        vm.secondTabLocked = true;
        vm.thirdTabLocked = true;

        var today = new Date();
        today.setHours(0,0,0,0); //Date at start of today
        vm.selectedDate = today;

        vm.selectedHour = "";
        vm.selectedSlot = '';
        vm.details = "";
        vm.hold = "";
        vm.total = 0;

        vm.userData = {};

        vm.loader = false;

        vm.dateFormat = reservationConfig.dateFormat;

        vm.datepickerTemplate = reservationConfig.datepickerTemplate;
        vm.availableHoursTemplate = reservationConfig.availableHoursTemplate;
        vm.noAvailableHoursTemplate = reservationConfig.noAvailableHoursTemplate;
        vm.clientFormTemplate = reservationConfig.clientFormTemplate;

        vm.datepickerOptions = $scope.datepickerOptions;
        vm.apiKey = $scope.apiKey;
        vm.vendor = $scope.vendor;
        vm.id = $scope.id;
        vm.externalId = $scope.externalId;
        vm.product = $scope.product;
        vm.variant = $scope.variant;

        $translate.use(reservationConfig.language);

        vm.userData.firstName = 'Robert';
        vm.userData.lastName = 'Stanica';
        vm.userData.phone = '4165550000';
        vm.userData.email = 'robertstanica@gmail.com';


        //METHODS
        // TODO This function should have all needed parameters in order to test it better
        vm.onSelectDate = function(date) {
            vm.selectedDate = date;
            vm.secondTabLocked = false;
            vm.selectedTab = 1;
            onBeforeGetAvailableHours({apiKey: vm.apiKey, vendor: vm.vendor, id:vm.id, date:date, externalId: vm.externalId});
        }

        vm.selectHour = function(time) {
            vm.thirdTabLocked = false;
            vm.selectedHour = new Date(time.startTime.replace('T', ' ').slice(0, -6));
            vm.selectedHour = $filter('date')(vm.selectedHour,'shortTime');
            vm.selectedSlot = time;
            onBeforeHoldDate(time);
        }

        vm.reserve = function(date, hour, userData) {
            onBeforeReserve(date, hour, userData);
        }


        vm.getDetails = function(){
            vm.loader = true;
            reservationAPIFactory.getDetails({apiKey: vm.apiKey, vendor: vm.vendor, id: vm.id, externalId: vm.externalId}).then(function(){
                vm.details = reservationAPIFactory.details;
                vm.loader = false;
            });
        }

        vm.getTotal = function(){
            var total = 0;
            for(var x=0; x<vm.details.length; x++){
                total += vm.details[x].selected * vm.details[x].price.amount;
            }
            return total;
        }

        vm.range = function(min, max, step) {
            step = step || 1;
            var input = [];
            for (var i = min; i <= max; i += step) {
                input.push(i);
            }
            return input;
        };

        //PRIVATE METHODS

        /**
         * Function executed before get available hours function.
         */
        function onBeforeGetAvailableHours(params) {
            /*
            reservationService.onBeforeGetAvailableHours(date).then(function () {
                getAvailableHours(date);

            }, function() {
                console.log("onBeforeGetAvailableHours: Rejected promise");
            });*/
            if(vm.vendor === 'bookeo'){
                var people = {};
                for(var x=0; x<vm.details.length; x++){
                    people[vm.details[x].id] = vm.details[x].selected;
                }
                params.people = people;
            }
            vm.loader = true;
            vm.availableHours = '';
            getAvailableHours(params);
        }

        /**
         * Function executed before get holding time slot.
         */
        function onBeforeHoldDate(params){
            if(vm.vendor === 'bookeo'){
                var people = {};
                for(var x=0; x<vm.details.length; x++){
                    people[vm.details[x].id] = vm.details[x].selected;
                }
                params.people = people;
            }
            var selectedDateFormatted = $filter('date')(vm.selectedDate, vm.dateFormat);
            reservationAPIFactory.hodl({apiKey: vm.apiKey, vendor: vm.vendor, id:vm.id, date:selectedDateFormatted, externalId: vm.externalId, eventId:params.eventId, people:params.people}).then(function(){
              vm.selectedTab = 2;
              vm.hold = reservationAPIFactory.hold;
            });
        }

        /**
         * Get available hours for a selected date
         */
        function getAvailableHours(params) {
            var selectedDateFormatted = $filter('date')(params.date, vm.dateFormat);
            params.date = selectedDateFormatted;

            reservationAPIFactory.getVendorAvailableHours(params).then(function (data) {
                vm.loader = false;

                //var status = vm.availableHoursStatus = reservationAPIFactory.status;
                //var message = vm.availableHoursMessage = reservationAPIFactory.message;

                //Completed get available hours callback
                //reservationService.onCompletedGetAvailableHours(status, message, date);

                vm.availableHours = reservationAPIFactory.availableHours;
                //Success
                if (status == 'SUCCESS') {
                    //vm.availableHours = reservationAPIFactory.availableHours;
                    //Successful get available hours callback
                    //reservationService.onSuccessfulGetAvailableHours(status, message, date, vm.availableHours);

                //Error
                } else {
                    //Error get available hours callback
                    //reservationService.onErrorGetAvailableHours(status, message, date);
                }
            });
        }

        /**
         * Function executed before reserve function
         */
        function onBeforeReserve(date, hour, userData) {
            var v = JSON.parse(vm.variant), product=JSON.parse(vm.product);
            userData.finalPrice = vm.hold.totalPayable.amount;
            reservationService.onBeforeReserve(date, hour, userData).then(function () {console.log('finished on before reserve');
                $rootScope.cart.addItem({sku:v.experienceSku, businessId:product.businessId, name:v.name, slug:product.slug, mrp:v.mrp, price:v.price, quantity:1, image:v.image,category:product.category, currency:vm.hold.totalPayable.currency, partner:product},true, false);
                var shipping = {
                    afterTax: vm.hold.totalPayable.amount,
                    charge: 0,
                    couponAmount: 0,
                    more: 999999,
                    tax: (vm.hold.price.totalTaxes.amount / vm.hold.price.totalNet.amount).toFixed(2),
                    total: vm.hold.price.totalNet.amount
                };
                var data = {tax:$rootScope.cart.taxes[product.address.region], businessId:product.businessId, currency:vm.hold.totalPayable.currency, phone:userData.phone, name:userData.firstName + ' ' + userData.lastName, payment:'Stripe', items:$rootScope.cart.items, shipping:shipping};
                Order.save(data, function(data){
                    console.log('saved order');
                    var obj = {};
                    obj.status = {};
                    obj.status.name = 'Bookeo Stripe Modal Incomplete';
                    obj.status.val = 150;
                    obj.phone = userData.phone;
                    Order.customer.updateStatus.update({id:data.transactionId}, obj);
                    console.log('checking out');
                    var paymentMethod = {};
                    PaymentMethod.active.query().$promise.then(function(res){console.log('<<',res);
                        for(var x=0; x<res.length; x++){
                            if(res[x].name === 'Stripe'){
                                paymentMethod = res[x];
                            }
                        }
                        $rootScope.cart.checkout({paymentMethod:paymentMethod, transactionId:data.transactionId, email:userData.email, currency:$rootScope.cart.items[0].currency, options: shipping},true, function(status){
                            console.log('>>',status);
                            reserve(date, hour, userData);
                        });
                    });
                }, function(err){
                    $scope.err = "There was an error confirming your purchase. Try refreshing the page or send us an email. Sorry about that!";
                });
                

            }, function() {
                console.log("onBeforeReserve: Rejected promise");
            });
        }

        /**
         * Do reserve POST with selectedDate, selectedHour and userData as parameters of the call
         */
        // TODO This function should have all needed parameters in order to test it better
        function reserve(date, hour, userData) {console.log(vm.details);
            vm.loader = true;

            var selectedDateFormatted = $filter('date')(date, vm.dateFormat);
            var people = {};
            if(vm.vendor === 'bookeo'){
                for(var x=0; x<vm.details.length; x++){
                    people[vm.details[x].id] = vm.details[x].selected;
                }
            }
            var params = {selectedDate: selectedDateFormatted, selectedHour: hour, userData: userData, holdId: vm.hold.id, timeSlot: vm.selectedSlot, apiKey: vm.apiKey, vendor: vm.vendor, id: vm.id, externalId: vm.externalId, people:people, title: vm.details[0].title};

            reservationAPIFactory.reserve(params).then(function () {
                vm.loader = false;

                var status = vm.reservationStatus = reservationAPIFactory.status;
                var message = vm.reservationMessage = reservationAPIFactory.message;

                //Completed reserve callback
                reservationService.onCompletedReserve(status, message, date, hour, userData);

                //Success
                if (status == 'SUCCESS') {
                    //Successful reserve calback
                    reservationService.onSuccessfulReserve(status, message, date, hour, userData);

                //Error
                } else {
                    //Error reserve callback
                    reservationService.onErrorReserve(status, message, date, hour, userData);
                }
            });
        }
    }

})();
/**
 * Reservation directive
 * @author hmartos
 */
(function() {
    //Directive
    angular.module('hm.reservation').directive('reservation', [function() {
        return {
            restrict: 'E',
            scope: {
                datepickerOptions: '=',
                apiKey: '@',
                vendor: '@',
                id: '@',
                externalId: '@',
                product: '@',
                variant: '@'

            },
            controller: 'ReservationCtrl',
            controllerAs: 'reservationCtrl',
            templateUrl: 'index.html'
        };
    }]);

})();
/**
 * Factory for reservation
 * @author hmartos
 */
(function() {
    function reservationAPIFactory($http, reservationConfig) {

        var reservationAPI = {};

        // Error details
        reservationAPI.status = "";
        reservationAPI.message = "";
        reservationAPI.details = "";
        reservationAPI.availableHours = "";
        reservationAPI.hold = "";


        //METHODS

        //Call to get product details
        reservationAPI.getDetails = function(params){
            return $http({
                method: 'POST',
                data: params,
                url: reservationConfig.getDetailsUrl,
                responseType: 'json'

            }).then(function(response) {
                //Success handler
                //console.log(response.data);

                reservationAPI.status = response.data.status;
                reservationAPI.details = response.data;

            }, function(response) {
                reservationAPI.errorManagement(response.status);
            });
        }

        //Call to get list of available hours
        reservationAPI.getAvailableHours = function(params) {
            return $http({
                method: 'GET',
                params: params,
                url: reservationConfig.getAvailableHoursAPIUrl,
                responseType: 'json'

            }).then(function(response) {
                //Success handler
                validateAvailableHoursResponseData(response.data);

                reservationAPI.status = response.data.status;
                reservationAPI.message = response.data.message;
                reservationAPI.availableHours = response.data.availableHours;

            }, function(response) {
                reservationAPI.errorManagement(response.status);
            });
        }

        reservationAPI.getVendorAvailableHours = function(params) {
            return $http({
                method: 'POST',
                data: params,
                url: reservationConfig.getAvailableHoursAPIUrl,
                responseType: 'json'

            }).then(function(response) {
                //Success handler
                
                //validateAvailableHoursResponseData(response.data);

                //reservationAPI.status = response.data.status;
                //reservationAPI.message = response.data.message;
                reservationAPI.availableHours = response.data.data;

            }, function(response) {
                reservationAPI.errorManagement(response.status);
            });
        }

        //Call to create temporary hold before finalizing booking
        reservationAPI.hodl = function(params){
           return $http({
                method: 'POST',
                data: params,
                url: reservationConfig.holdSlotAPIUrl,
                responseType: 'json'

            }).then(function(response) {
                //Success handler
                console.log(response.data);
                reservationAPI.hold = response.data;
                //validateReserveResponseData(response.data);
                //reservationAPI.status = response.data.status;
                //reservationAPI.message = response.data.message;

            }, function(response) {
                reservationAPI.errorManagement(response.status);
            });
        }

        //Call to do a reserve
        reservationAPI.reserve = function(params) {
            return $http({
                method: 'POST',
                data: params,
                url: reservationConfig.reserveAPIUrl,
                responseType: 'json'

            }).then(function(response) {
                //Success handler
                console.log(response.data);
                validateReserveResponseData(response.data);
                reservationAPI.status = response.data.status;
                reservationAPI.message = response.data.message;

            }, function(response) {
                reservationAPI.errorManagement(response.status);
            });
        }


        //Error management function, handles different kind of status codes
        reservationAPI.errorManagement = function(status) {
            resetVariables();
            switch (status) {
                case 500: //Server error
                    reservationAPI.status = "SERVER_ERROR";
                    break;
                default: //Other error, typically connection error
                    reservationAPI.status = "CONNECTION_ERROR";
                    break;
            }
        }

        //Reset factory variables when an error occurred
        function resetVariables() {
            reservationAPI.status = "";
            reservationAPI.message = "";
            reservationAPI.availableHours = "";
        }

        //Validate if available hours response has expected keys
        function validateAvailableHoursResponseData(data) {
            if(!data.hasOwnProperty('status')) console.error("Get available hours response should have a 'status' key");
            if(!data.hasOwnProperty('message')) console.error("Get available hours response should have a 'message' key");
            if(!data.hasOwnProperty('availableHours')) console.error("Get available hours response should have a 'availableHours' key");
        }

        //Validate if reserve response has expected keys
        function validateReserveResponseData(data) {
            if(!data.hasOwnProperty('status')) console.error("Reserve response should have a 'status' key");
            if(!data.hasOwnProperty('message')) console.error("Reserve response should have a 'message' key");
        }


        return reservationAPI;
    }
    angular.module('hm.reservation').filter('ignoreTimeZone', function(){
      return function(val){
          var newDate = new Date(val.replace('T', ' ').slice(0, -6));
         return newDate;
      };
    });
    angular.module('hm.reservation').factory('reservationAPIFactory', ['$http', 'reservationConfig', reservationAPIFactory]);
})();
/**
 * Service for reservation management
 * @author hmartos
 */
(function() {
    function reservationService($q, $filter, $uibModal, reservationConfig) {

        //Before get available hours callback
        this.onBeforeGetAvailableHours = function(selectedDate) {
            console.log("Executing before get available hours callback");
            var deferred = $q.defer();

            deferred.resolve();
            //deferred.reject();

            return deferred.promise;
        }

        //Completed get available hours callback
        this.onCompletedGetAvailableHours = function(status, message, selectedDate) {
            console.log("Executing completed get available hours callback");
        }

        //Success get available hours callback
        this.onSuccessfulGetAvailableHours = function(status, message, selectedDate, availableHours) {
            console.log("Executing successful get available hours callback");
        }

        //Error get available hours callback
        this.onErrorGetAvailableHours = function(status, message, selectedDate) {
            console.log("Executing error get available hours callback");
        }

        //Before reserve callback
        this.onBeforeReserve = function(selectedDate, selectedHour, userData) {
            console.log("Executing before reserve callback");
            var deferred = $q.defer();

            if(reservationConfig.showConfirmationModal) {
                openConfirmationModal(deferred, selectedDate, selectedHour, userData);

            } else {
                deferred.resolve();
                //deferred.reject();
            }

            return deferred.promise;
        }


        //Completed reserve callback
        this.onCompletedReserve = function(status, message, selectedDate, selectedHour, userData) {
            console.log("Executing completed reserve callback");
        }

        //Success reserve callback
        this.onSuccessfulReserve = function(status, message, reservedDate, reservedHour, userData) {
            console.log("Executing successful reserve callback");
        }

        //Error reserve callback
        this.onErrorReserve = function(status, message, selectedDate, selectedHour, userData) {
            console.log("Executing error reserve callback");
        }

        /**
         * Opens confirmation modal
         */
        function openConfirmationModal(deferred, selectedDate, selectedHour, userData) {
            var modalInstance = $uibModal.open({
                templateUrl: reservationConfig.confirmationModalTemplate,
                size: 'sm',
                controller: ['selectedDate', 'selectedHour', 'userData', confirmationModalCtrl],
                controllerAs: 'confirmationModalCtrl',
                resolve: {
                    selectedDate: function () {
                        return $filter('date')(selectedDate, reservationConfig.dateFormat);
                    },
                    selectedHour: function () {
                        return selectedHour;
                    },
                    userData: function () {
                        return userData;
                    }
                }
            });

            modalInstance.result.then(function () {
                console.log("Accepted");
                deferred.resolve();

            }, function () {
                console.log("Cancelled");
                deferred.reject();
            })
        }

        /**
         * Controller for confirmation modal
         */
        function confirmationModalCtrl(selectedDate, selectedHour, userData) {
            var vm = this;

            vm.selectedDate = selectedDate;
            vm.selectedHour = selectedHour;
            vm.userData = userData;

            vm.translationParams = {
                name: userData.firstName + ' ' + userData.lastName,
                selectedDate: selectedDate,
                selectedHour: selectedHour
            }
        }

    }
    angular.module('hm.reservation').service('reservationService', ['$q', '$filter', '$uibModal', 'reservationConfig', reservationService]);
})();
/**
 * Internationalization file with translations
 * @author hmartos
 */
(function() {
    "use strict";
    angular.module('hm.reservation').config(['$translateProvider', function($translateProvider) {
        $translateProvider.translations('en', {
            date: "Date",
            time: "Time",
            client: "Client",
            firstName: "First Name",
            lastName: "Last Name",
            finalPrice: "Final Price",
            save: "Save",
            cancel: "Cancel",
            select: "Select",
            phone: "Phone",
            email: "Email",
            required: "This field is required",
            minLength: "Minimum length of {{minLength}} is required",
            maxLength: "Maximum length of {{maxLength}} is required",
            invalidCharacters: "Not allowed characters",
            invalidPhone: "Invalid phone number",
            invalidEmail: "Invalid email address",
            reserve: "Reserve",
            confirmOK: "Yes, reserve",
            confirmCancel: "No, cancel",
            confirmTitle: "Confirm reservation",
            confirmText: "{{name}}, are you sure you want to reserve date {{selectedDate | date : 'shortDate'}} at {{selectedHour}}?",
            noAvailableHours: "There are no available hours for the selected date. Please select another date"
        });

        $translateProvider.translations('es', {
            date: "Fecha",
            time: "Hora",
            client: "Cliente",
            name: "Nombre",
            save: "Guardar",
            cancel: "Cancelar",
            select: "Seleccionar",
            phone: "Teléfono",
            email: "Email",
            required: "Este campo no puede estar vacío",
            minLength: "El número mínimo de carácteres es {{minLength}}",
            maxLength: "El número máximo de carácteres es {{maxLength}}",
            invalidCharacters: "Caracteres no permitidos",
            invalidPhone: "Número de teléfono no válido",
            invalidEmail: "Email no válido",
            reserve: "Reservar",
            confirmOK: "Sí, reservar",
            confirmCancel: "No, cancelar",
            confirmTitle: "Confirmar reserva",
            confirmText: "{{name}}, ¿Estás seguro de que deseas reservar el día {{selectedDate}} a las {{selectedHour}}?.",
            noAvailableHours: "No hay horas disponibles para la fecha seleccionada, por favor selecciona otra fecha"
        });

        //Available languages map
        $translateProvider.registerAvailableLanguageKeys(['es', 'en'], {
            'es_*': 'es',
            'en_*': 'en'
        });

        //Determine preferred language
        $translateProvider.determinePreferredLanguage();

        //Escapes HTML in the translation
        $translateProvider.useSanitizeValueStrategy('escaped');

    }]);
})();
angular.module("hm.reservation").run(["$templateCache", function($templateCache) {$templateCache.put("availableHours.html","<a class=\"list-group-item\" href=\"\" ng-repeat=\"item in reservationCtrl.availableHours\" ng-click=\"reservationCtrl.selectHour(item)\"\r\n   ng-class=\"{\'angular-reservation-selected\': reservationCtrl.selectedHour == item}\">\r\n    <span>{{item.startTime | ignoreTimeZone | date  : \'shortTime\'}}</span>\r\n</a>");
$templateCache.put("clientForm.html","<div class=\"col-md-12 angular-reservation-clientForm\">\r\n    <div class=\"form-group col-md-12\">\r\n        <label class=\"col-md-3 control-label\" for=\"firstName\">First Name</label>\r\n        <div class=\"col-md-9\">\r\n            <div class=\"input-group\">\r\n            <span class=\"input-group-addon\">\r\n                <span class=\"glyphicon glyphicon-user\" aria-hidden=\"true\" style=\"font-size: 14px\"></span>\r\n            </span>\r\n\r\n                <input id=\"firstName\" name=\"firstName\" class=\"form-control\" placeholder=\"First Name\" type=\"text\" ng-model=\"reservationCtrl.userData.firstName\"\r\n                       autofocus=\"true\" ng-pattern=\"/^[\\w\\s\\-\\x7f-\\xff]*$/\" ng-minlength=\"2\" ng-maxlength=\"100\" required>\r\n            </div>\r\n\r\n            <div class=\"help-block\" ng-messages=\"reserveForm.firstName.$error\" ng-if=\"reserveForm.$submitted\">\r\n                <p ng-message=\"minlength\" class=\"text-danger\">{{\"minLength\" | translate: \'{minLength: \"2\"}\'}}</p>\r\n                <p ng-message=\"maxlength\" class=\"text-danger\">{{\"maxLength\" | translate: \'{maxLength: \"100\"}\'}}</p>\r\n                <p ng-message=\"pattern\" class=\"text-danger\">{{\"invalidCharacters\" | translate}}</p>\r\n                <p ng-message=\"required\" class=\"text-danger\">{{\"required\" | translate}}</p>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class=\"form-group col-md-12\">\r\n        <label class=\"col-md-3 control-label\" for=\"lastName\">Last Name</label>\r\n        <div class=\"col-md-9\">\r\n            <div class=\"input-group\">\r\n            <span class=\"input-group-addon\">\r\n                <span class=\"glyphicon glyphicon-user\" aria-hidden=\"true\" style=\"font-size: 14px\"></span>\r\n            </span>\r\n\r\n                <input id=\"lastName\" name=\"lastName\" class=\"form-control\" placeholder=\"Last Name\" type=\"text\" ng-model=\"reservationCtrl.userData.lastName\"\r\n                       autofocus=\"true\" ng-pattern=\"/^[\\w\\s\\-\\x7f-\\xff]*$/\" ng-minlength=\"2\" ng-maxlength=\"100\" required>\r\n            </div>\r\n\r\n            <div class=\"help-block\" ng-messages=\"reserveForm.lastName.$error\" ng-if=\"reserveForm.$submitted\">\r\n                <p ng-message=\"minlength\" class=\"text-danger\">{{\"minLength\" | translate: \'{minLength: \"2\"}\'}}</p>\r\n                <p ng-message=\"maxlength\" class=\"text-danger\">{{\"maxLength\" | translate: \'{maxLength: \"100\"}\'}}</p>\r\n                <p ng-message=\"pattern\" class=\"text-danger\">{{\"invalidCharacters\" | translate}}</p>\r\n                <p ng-message=\"required\" class=\"text-danger\">{{\"required\" | translate}}</p>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class=\"form-group col-md-12\">\r\n        <label class=\"col-md-3 control-label\" for=\"phone\">{{\"phone\" | translate}}</label>\r\n        <div class=\"col-md-9\">\r\n            <div class=\"input-group\">\r\n            <span class=\"input-group-addon\">\r\n                <span class=\"glyphicon glyphicon-earphone\" aria-hidden=\"true\" style=\"font-size: 14px\"></span>\r\n            </span>\r\n\r\n                <input id=\"phone\" name=\"phone\" class=\"form-control\" placeholder=\"{{\'phone\' | translate}}\" type=\"tel\" ng-model=\"reservationCtrl.userData.phone\"\r\n                       ng-pattern=\"/^[0-9]*$/\" ng-minlength=\"5\" ng-maxlength=\"15\" required>\r\n            </div>\r\n\r\n            <div class=\"help-block\" ng-messages=\"reserveForm.phone.$error\" ng-if=\"reserveForm.$submitted\">\r\n                <p ng-message=\"minlength\" class=\"text-danger\">{{\"minLength\" | translate: \'{minLength: \"5\"}\'}}</p>\r\n                <p ng-message=\"maxlength\" class=\"text-danger\">{{\"maxLength\" | translate: \'{maxLength: \"15\"}\'}}</p>\r\n                <p ng-message=\"pattern\" class=\"text-danger\">{{\"invalidPhone\" | translate}}</p>\r\n                <p ng-message=\"required\" class=\"text-danger\">{{\"required\" | translate}}</p>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class=\"form-group col-md-12\">\r\n        <label class=\"col-md-3 control-label\" for=\"email\">{{\"email\" | translate}}</label>\r\n        <div class=\"col-md-9\">\r\n            <div class=\"input-group\">\r\n            <span class=\"input-group-addon\">\r\n                <span class=\"glyphicon glyphicon-envelope\" aria-hidden=\"true\" style=\"font-size: 14px\"></span>\r\n            </span>\r\n\r\n                <input id=\"email\" name=\"email\" class=\"form-control\" placeholder=\"{{\'email\' | translate}}\" type=\"text\" ng-model=\"reservationCtrl.userData.email\"\r\n                       ng-pattern=\"/[\\w|.|-]*@\\w*\\.[\\w|.]*/\" required>\r\n            </div>\r\n\r\n            <div class=\"help-block\" ng-messages=\"reserveForm.email.$error\" ng-if=\"reserveForm.$submitted\">\r\n                <p ng-message=\"pattern\" class=\"text-danger\">{{\"invalidEmail\" | translate}}</p>\r\n                <p ng-message=\"required\" class=\"text-danger\">{{\"required\" | translate}}</p>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class=\"col-md-12\">\r\n        <button id=\"reserve\" type=\"submit\" name=\"reserve\" class=\"btn btn-success pull-right\">{{\"reserve\" | translate}}</button>\r\n    </div>\r\n\r\n    <div class=\"col-md-12\">\r\n        <div uib-alert class=\"alert-success text-center\" ng-if=\"reservationCtrl.reservationStatus == \'SUCCESS\'\" style=\"margin-top: 1em\">\r\n            <span>Success!</span>\r\n            <p ng-if=\"reservationCtrl.reservationMessage\">{{reservationCtrl.reservationMessage}}</p>\r\n        </div>\r\n\r\n        <div uib-alert class=\"alertt-danger text-center\" ng-if=\"reservationCtrl.reservationStatus == \'ERROR\'\" style=\"margin-top: 1em\">\r\n            <span>Error!</span>\r\n            <p ng-if=\"reservationCtrl.reservationMessage\">{{reservationCtrl.reservationMessage}}</p>\r\n        </div>\r\n    </div>\r\n</div>");
$templateCache.put("confirmationModal.html","<div class=\"modal-header\">\r\n    <h3 class=\"modal-title\">{{\"confirmTitle\" | translate}}</h3>\r\n</div>\r\n\r\n<div class=\"modal-body\">\r\n    <h5>{{\"confirmText\" | translate : confirmationModalCtrl.translationParams}}</h5>\r\n\r\n    <div ng-repeat=\"(key, value) in confirmationModalCtrl.userData track by $index\">\r\n        <label class=\"control-label text-muted\">{{key | translate}}:</label>\r\n		\r\n        <h5 ng-if=\"key!==\'finalPrice\'\" class=\"angular-reservation-h5\">{{value}}</h5>\r\n        <h5 ng-if=\"key===\'finalPrice\'\" class=\"angular-reservation-h5\">{{value | currency}}</h5>\r\n    </div>\r\n</div>\r\n\r\n<div class=\"modal-footer\">\r\n    <button class=\"btn btn-danger\" type=\"button\" ng-click=\"$dismiss()\">{{\"confirmCancel\" | translate}}</button>\r\n    <button class=\"btn btn-success\" type=\"button\" ng-click=\"$close()\">{{\"confirmOK\" | translate}}</button>\r\n</div>");
$templateCache.put("datepicker.html","<div class=\"row\">\r\n	<div class=\"col-md-12\">\r\n		<h3 class=\"text-center\">Total: {{reservationCtrl.getTotal() | currency}}</h3>\r\n		<div ng-repeat=\"person in reservationCtrl.details\">\r\n			<div class=\"row angular-reservation-padding\">\r\n				<div class=\"col-md-8\">\r\n					{{person.name}} - <span class=\"text-muted \">{{person.price.amount | currency}}</span>\r\n				</div>\r\n				<div class=\"col-md-4 text-right\">\r\n				 	<div class=\"btn-group text-left\" style=\"background:none\" uib-dropdown>\r\n						<button id=\"split-button\" type=\"button\" class=\"btn btn-sm btn-default\">{{reservationCtrl.details[$index].selected}}</button>\r\n			      <button type=\"button\" class=\"btn btn-sm btn-default\" uib-dropdown-toggle>\r\n			        <span class=\"caret\"></span>\r\n			      </button>\r\n			      <ul class=\"dropdown-menu\" uib-dropdown-menu role=\"menu\" aria-labelledby=\"split-button\">\r\n			       <li ng-class=\"{active : o === person.selected}\" ng-repeat=\"o in reservationCtrl.range(reservationCtrl.details[$index].min, reservationCtrl.details[$index].max)\" role=\"menuitem\"><a ng-click=\"reservationCtrl.details[$parent.$index].selected = o\">{{o}}</a></li>\r\n		     		</ul>\r\n			    </div>\r\n				</div>\r\n			</div>\r\n		</div>\r\n	</div>\r\n\r\n	<div class=\"col-md-12\">\r\n		<div uib-datepicker class=\"angular-reservation-datepicker\" ng-model=\"reservationCtrl.selectedDate\" datepicker-options=\"reservationCtrl.datepickerOptions\"\r\n	     ng-change=\"reservationCtrl.onSelectDate(reservationCtrl.selectedDate)\"></div>\r\n	</div>\r\n</div>");
$templateCache.put("index.html","<div class=\"outlined\" ng-init=\"reservationCtrl.getDetails()\">\r\n    <uib-tabset active=\"reservationCtrl.selectedTab\" justified=\"true\" class=\"angular-reservation-bump\">\r\n        <uib-tab index=\"0\" style=\"border-radius:0\">\r\n            <uib-tab-heading>\r\n                <span class=\"glyphicon glyphicon-calendar\" aria-hidden=\"true\" class=\"angular-reservation-icon-size\"></span>\r\n                <h5 ng-if=\"reservationCtrl.secondTabLocked\">{{\"date\" | translate}}</h5>\r\n                <h5 ng-if=\"!reservationCtrl.secondTabLocked\">{{reservationCtrl.selectedDate | date: reservationCtrl.dateFormat}}</h5>\r\n            </uib-tab-heading>\r\n            <div class=\"spacer\" ng-if=\"reservationCtrl.loader\"></div>\r\n            <div ng-include=\"\'loader.html\'\" class=\"text-center\" ng-if=\"reservationCtrl.loader\"></div>\r\n            <div ng-include=\"reservationCtrl.datepickerTemplate\"></div>\r\n        </uib-tab>\r\n\r\n        <uib-tab index=\"1\" disable=\"reservationCtrl.secondTabLocked\">\r\n            <uib-tab-heading>\r\n                <span class=\"glyphicon glyphicon-time\" aria-hidden=\"true\" class=\"angular-reservation-icon-size\"></span>\r\n                <h5 ng-if=\"reservationCtrl.thirdTabLocked\">{{\"time\" | translate}}</h5>\r\n                <h5 ng-if=\"!reservationCtrl.thirdTabLocked\">{{reservationCtrl.selectedHour}}</h5>\r\n            </uib-tab-heading>\r\n\r\n            <div class=\"spacer\" ng-if=\"reservationCtrl.loader\"></div>\r\n            <div ng-include=\"\'loader.html\'\" class=\"text-center\" ng-if=\"reservationCtrl.loader\"></div>\r\n\r\n            <div class=\"angular-reservation-availableHour\" ng-if=\"!reservationCtrl.loader && reservationCtrl.availableHours.length > 0\">\r\n                <div ng-include=\"reservationCtrl.availableHoursTemplate\"></div>\r\n            </div>\r\n\r\n            <div ng-if=\"!reservationCtrl.loader && reservationCtrl.availableHours.length == 0\">\r\n                <div ng-include=\"reservationCtrl.noAvailableHoursTemplate\"></div>\r\n            </div>\r\n        </uib-tab>\r\n\r\n        <uib-tab index=\"2\" disable=\"reservationCtrl.thirdTabLocked\">\r\n            <uib-tab-heading>\r\n                <span class=\"glyphicon glyphicon-user\" aria-hidden=\"true\" class=\"angular-reservation-icon-size\"></span>\r\n                <h5>{{\"client\" | translate}}</h5>\r\n            </uib-tab-heading>\r\n\r\n            <form class=\"form-horizontal\" name=\"reserveForm\" novalidate\r\n                  ng-submit=\"reserveForm.$valid && reservationCtrl.reserve(reservationCtrl.selectedDate, reservationCtrl.selectedHour, reservationCtrl.userData)\">\r\n                <div class=\"spacer\" ng-if=\"reservationCtrl.loader\"></div>\r\n                <div ng-include=\"\'loader.html\'\" class=\"text-center\" ng-if=\"reservationCtrl.loader\"></div>\r\n\r\n                <fieldset ng-if=\"!reservationCtrl.loader\">\r\n                    <div ng-include=\"reservationCtrl.clientFormTemplate\"></div>\r\n                </fieldset>\r\n            </form>\r\n        </uib-tab>\r\n    </uib-tabset>\r\n</div>\r\n");
$templateCache.put("loader.html","<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" version=\"1\" width=\"50px\" height=\"50px\" viewBox=\"0 0 28 28\">\r\n    <!-- 28= RADIUS*2 + STROKEWIDTH -->\r\n\r\n    <title>Material design circular activity spinner with CSS3 animation</title>\r\n    <style type=\"text/css\">\r\n        /**************************/\r\n        /* STYLES FOR THE SPINNER */\r\n        /**************************/\r\n\r\n        /*\r\n         * Constants:\r\n         *      RADIUS      = 12.5\r\n         *      STROKEWIDTH = 3\r\n         *      ARCSIZE     = 270 degrees (amount of circle the arc takes up)\r\n         *      ARCTIME     = 1333ms (time it takes to expand and contract arc)\r\n         *      ARCSTARTROT = 216 degrees (how much the start location of the arc\r\n         *                                should rotate each time, 216 gives us a\r\n         *                                5 pointed star shape (it\'s 360/5 * 2).\r\n         *                                For a 7 pointed star, we might do\r\n         *                                360/7 * 3 = 154.286)\r\n         *\r\n         *      SHRINK_TIME = 400ms\r\n         */\r\n\r\n        .qp-circular-loader {\r\n            width:28px;  /* 2*RADIUS + STROKEWIDTH */\r\n            height:28px; /* 2*RADIUS + STROKEWIDTH */\r\n        }\r\n        .qp-circular-loader-path {\r\n            stroke-dasharray: 58.9;  /* 2*RADIUS*PI * ARCSIZE/360 */\r\n            stroke-dashoffset: 58.9; /* 2*RADIUS*PI * ARCSIZE/360 */\r\n            /* hides things initially */\r\n        }\r\n\r\n        /* SVG elements seem to have a different default origin */\r\n        .qp-circular-loader, .qp-circular-loader * {\r\n            -webkit-transform-origin: 50% 50%;\r\n            -moz-transform-origin: 50% 50%;\r\n        }\r\n\r\n        /* Rotating the whole thing */\r\n        @-webkit-keyframes rotate {\r\n            from {-webkit-transform: rotate(0deg);}\r\n            to {-webkit-transform: rotate(360deg);}\r\n        }\r\n        @-moz-keyframes rotate {\r\n            from {-webkit-transform: rotate(0deg);}\r\n            to {-webkit-transform: rotate(360deg);}\r\n        }\r\n        .qp-circular-loader {\r\n            -webkit-animation-name: rotate;\r\n            -webkit-animation-duration: 1568.63ms; /* 360 * ARCTIME / (ARCSTARTROT + (360-ARCSIZE)) */\r\n            -webkit-animation-iteration-count: infinite;\r\n            -webkit-animation-timing-function: linear;\r\n            -moz-animation-name: rotate;\r\n            -moz-animation-duration: 1568.63ms; /* 360 * ARCTIME / (ARCSTARTROT + (360-ARCSIZE)) */\r\n            -moz-animation-iteration-count: infinite;\r\n            -moz-animation-timing-function: linear;\r\n        }\r\n\r\n        /* Filling and unfilling the arc */\r\n        @-webkit-keyframes fillunfill {\r\n            from {\r\n                stroke-dashoffset: 58.8 /* 2*RADIUS*PI * ARCSIZE/360 - 0.1 */\r\n                /* 0.1 a bit of a magic constant here */\r\n            }\r\n            50% {\r\n                stroke-dashoffset: 0;\r\n            }\r\n            to {\r\n                stroke-dashoffset: -58.4 /* -(2*RADIUS*PI * ARCSIZE/360 - 0.5) */\r\n                /* 0.5 a bit of a magic constant here */\r\n            }\r\n        }\r\n        @-moz-keyframes fillunfill {\r\n            from {\r\n                stroke-dashoffset: 58.8 /* 2*RADIUS*PI * ARCSIZE/360 - 0.1 */\r\n                /* 0.1 a bit of a magic constant here */\r\n            }\r\n            50% {\r\n                stroke-dashoffset: 0;\r\n            }\r\n            to {\r\n                stroke-dashoffset: -58.4 /* -(2*RADIUS*PI * ARCSIZE/360 - 0.5) */\r\n                /* 0.5 a bit of a magic constant here */\r\n            }\r\n        }\r\n        @-webkit-keyframes rot {\r\n            from {\r\n                -webkit-transform: rotate(0deg);\r\n            }\r\n            to {\r\n                -webkit-transform: rotate(-360deg);\r\n            }\r\n        }\r\n        @-moz-keyframes rot {\r\n            from {\r\n                -webkit-transform: rotate(0deg);\r\n            }\r\n            to {\r\n                -webkit-transform: rotate(-360deg);\r\n            }\r\n        }\r\n        @-moz-keyframes colors {\r\n            0% {\r\n                stroke: #4285F4;\r\n            }\r\n            25% {\r\n                stroke: #DE3E35;\r\n            }\r\n            50% {\r\n                stroke: #F7C223;\r\n            }\r\n            75% {\r\n                stroke: #1B9A59;\r\n            }\r\n            100% {\r\n                stroke: #4285F4;\r\n            }\r\n        }\r\n\r\n        @-webkit-keyframes colors {\r\n            0% {\r\n                stroke: #4285F4;\r\n            }\r\n            25% {\r\n                stroke: #DE3E35;\r\n            }\r\n            50% {\r\n                stroke: #F7C223;\r\n            }\r\n            75% {\r\n                stroke: #1B9A59;\r\n            }\r\n            100% {\r\n                stroke: #4285F4;\r\n            }\r\n        }\r\n\r\n        @keyframes colors {\r\n            0% {\r\n                stroke: #4285F4;\r\n            }\r\n            25% {\r\n                stroke: #DE3E35;\r\n            }\r\n            50% {\r\n                stroke: #F7C223;\r\n            }\r\n            75% {\r\n                stroke: #1B9A59;\r\n            }\r\n            100% {\r\n                stroke: #4285F4;\r\n            }\r\n        }\r\n        .qp-circular-loader-path {\r\n            -webkit-animation-name: fillunfill, rot, colors;\r\n            -webkit-animation-duration: 1333ms, 5332ms, 5332ms; /* ARCTIME, 4*ARCTIME, 4*ARCTIME */\r\n            -webkit-animation-iteration-count: infinite, infinite, infinite;\r\n            -webkit-animation-timing-function: cubic-bezier(0.4, 0.0, 0.2, 1), steps(4), linear;\r\n            -webkit-animation-play-state: running, running, running;\r\n            -webkit-animation-fill-mode: forwards;\r\n\r\n            -moz-animation-name: fillunfill, rot, colors;\r\n            -moz-animation-duration: 1333ms, 5332ms, 5332ms; /* ARCTIME, 4*ARCTIME, 4*ARCTIME */\r\n            -moz-animation-iteration-count: infinite, infinite, infinite;\r\n            -moz-animation-timing-function: cubic-bezier(0.4, 0.0, 0.2, 1), steps(4), linear;\r\n            -moz-animation-play-state: running, running, running;\r\n            -moz-animation-fill-mode: forwards;\r\n        }\r\n\r\n    </style>\r\n\r\n    <!-- 3= STROKEWIDTH -->\r\n    <!-- 14= RADIUS + STROKEWIDTH/2 -->\r\n    <!-- 12.5= RADIUS -->\r\n    <!-- 1.5=  STROKEWIDTH/2 -->\r\n    <!-- ARCSIZE would affect the 1.5,14 part of this... 1.5,14 is specific to\r\n         270 degress -->\r\n    <g class=\"qp-circular-loader\">\r\n        <path class=\"qp-circular-loader-path\" fill=\"none\" d=\"M 14,1.5 A 12.5,12.5 0 1 1 1.5,14\" stroke-width=\"3\" stroke-linecap=\"round\"/>\r\n    </g>\r\n</svg>");
$templateCache.put("noAvailableHours.html","<span class=\"angular-reservation-noAvailableHours\">{{\"noAvailableHours\" | translate}}</span>");}]);