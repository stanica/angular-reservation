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
    angular.module('hm.reservation').controller('ReservationCtrl', ['$scope', '$rootScope', '$filter', '$window', '$translate', 'reservationAPIFactory', 'reservationConfig', 'reservationService', 'Order', 'PaymentMethod', 'Stripe', reservationCtrl]);

    function reservationCtrl($scope, $rootScope, $filter, $window, $translate, reservationAPIFactory, reservationConfig, reservationService, Order, PaymentMethod, _Stripe) {
        //Capture the this context of the Controller using vm, standing for viewModel
        var vm = this;

        var blackList = ['Detective Story', 'Outer Space', 'John Doe', 'The Experiment'];

        vm.selectedTab = 0;
        vm.secondTabLocked = true;
        vm.thirdTabLocked = true;
        vm.showSummary = false;

        var today = new Date();
        today.setHours(0,0,0,0); //Date at start of today
        vm.selectedDate = today;

        vm.selectedHour = "";
        vm.selectedSlot = '';
        vm.details = "";
        vm.detailsError = false;
        vm.hold = "";
        vm.holdStatus = '';
        vm.holdStatusMessage = '';
        vm.total = 0; //Price total
        vm.totalAmount = 0; //Price total
        vm.totalSelectedPeople = 0; //Number of people
        vm.selectedPeople = false;
        vm.minimumPeople = 0;

        vm.userData = {};

        vm.loader = false;
        vm.loaderFareharbor = false;
        vm.showOr = false;
        vm.showBreakdown = false;

        vm.dateFormat = reservationConfig.dateFormat;

        vm.datepickerTemplate = reservationConfig.datepickerTemplate;
        vm.availableHoursTemplate = reservationConfig.availableHoursTemplate;
        vm.noAvailableHoursTemplate = reservationConfig.noAvailableHoursTemplate;
        vm.clientFormTemplate = reservationConfig.clientFormTemplate;

        vm.datepickerOptions = $scope.datepickerOptions;
        vm.dateDisabled = vm.datepickerOptions.dateDisabled({date: new Date(vm.selectedDate)});
        vm.apiKey = $scope.apiKey;
        vm.vendor = $scope.vendor;
        vm.id = $scope.id;
        vm.externalId = $scope.externalId;
        vm.product = JSON.parse($scope.product);
        vm.variant = '';
        for(var x=0; x<vm.product.variants.length; x++){
            if(vm.product.variants[x].externalSku === vm.externalId){
                vm.variant = vm.product.variants[x];
                break;
            }
        }
        vm.user = $scope.user;
        vm.experienceTitle = '';
        vm.currency = $scope.currency;

        $translate.use(reservationConfig.language);

        //METHODS
        // TODO This function should have all needed parameters in order to test it better
        vm.onSelectDate = function(date) {
            removeHold().then(function(result){
                ga('send', 'event', 'calendar-widget', 'next');
                var product = vm.product;
                var variant = vm.variant;
                var market = '';
                for(var x=0; x<product.features.length; x++){
                    if(product.features[x].key === 'Market'){
                        market = product.features[x].val;
                        break;
                    }
                }
                fbq('track', 'AddToCart', {
                    content_name: product.name + ' - ' + variant.name,
                    content_category: product.category.name,
                    content_type: market 
                  });
                vm.hold = '';
                try {
                    vm.selectedDate = date.toDateString();
                }
                catch(e){
                    vm.selectedDate = new Date(date).toDateString();
                }
                vm.secondTabLocked = false;
                vm.selectedTab = 1;
                $rootScope.scrollToAnchorMobile('calendar-top');
                onBeforeGetAvailableHours({apiKey: vm.apiKey, vendor: vm.vendor, id:vm.id, date:date, externalId: vm.externalId});
            });
        }

        vm.selectAnotherDate = function() {
            vm.holdStatus = ''
            vm.selectedTab = 0;
            vm.secondTabLocked = true;
        }

        vm.update = function(date){
            vm.dateDisabled = vm.datepickerOptions.dateDisabled({date: new Date(date)});
            if(vm.vendor === 'fareharbor api'){
                vm.details = [];
                onBeforeGetAvailableHours({apiKey: vm.apiKey, vendor: vm.vendor, id:vm.id, date:date, externalId: vm.externalId});
            }
            if(vm.details[0]){
                vm.currency = vm.details[0].price.currency;
            }
        }

        vm.selectHour = function(time) {
            removeHold().then(function(result){
                ga('send', 'event', 'calendar-widget', 'select-hour');
                vm.hold = '';
                vm.loader = true;
                vm.selectedHour = new Date(time.startTime.replace('T', ' ').replace(/-/g,'/').slice(0, -6));
                vm.selectedHour = $filter('date')(vm.selectedHour,'shortTime');
                vm.selectedSlot = time;
                onBeforeHoldDate(time);
            });
        }

        vm.reserve = function(date, hour, userData) {
            //vm.showSummary = true;
            onBeforeReserve(date, hour, userData, null);
        }

        vm.setSummary = function(state){
            vm.selectedTab = 0;
            // vm.showSummary = state;
            // if(!state){
            //     vm.selectedTab = 0;
            // }
            // $rootScope.scrollToAnchorMobile('calendar-top');
        }

        vm.toTitleCase = function(str)
        {
            return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
        }

        vm.getDetails = function(){
            if(vm.vendor !== 'fareharbor api'){
                vm.loader = true;
            }
            reservationAPIFactory.getDetails({apiKey: vm.apiKey, vendor: vm.vendor, id: vm.id, externalId: vm.externalId}).then(function(data){
                if(reservationAPIFactory.status === 'SERVER_ERROR'){
                    vm.loader = false;
                    vm.detailsError = true;
                }
                else {
                    vm.experienceTitle = reservationAPIFactory.details[0].title;
                    if(vm.vendor !== 'fareharbor api'){
                        vm.details = reservationAPIFactory.details;
                        if(blackList.indexOf(vm.details[0].title) > -1){
                            vm.details[0].price.amount = '';
                        }
                    }
                }
                vm.loader = false;
                vm.loaderFareharbor = false;
            }, function(err){
                console.log(err);
                vm.loader = false;
                vm.loaderFareharbor = false;
            });
            
        }

        vm.getTotal = function(){
            var total = 0;
            for(var x=0; x<vm.details.length; x++){
                total += vm.details[x].selected * vm.details[x].price.amount;
            }
            return total;
        }

        vm.getTotalPeople = function() {
            var total = 0;
            for(var x=0; x<vm.details.length; x++){
                total += vm.details[x].selected === ' ' ? 0 : vm.details[x].selected;
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
            var people = {};
            vm.totalSelectedPeople = 0;
            vm.totalAmount = 0;
            for(var x=0; x<vm.details.length; x++){
                if(typeof vm.details[x].selected === 'number'){
                    people[vm.details[x].id] = vm.details[x].selected;
                    vm.totalSelectedPeople += vm.details[x].selected;
                    vm.totalAmount += vm.details[x].price.amount * vm.details[x].selected;
                }
            }
            params.people = people;
            if(vm.vendor === 'bookeo'){
                vm.loader = true;
            }
            else if(vm.vendor === 'fareharbor api'){
                vm.loaderFareharbor = true;
            }
            vm.availableHours = null;
            getAvailableHours(params);
        }

        /**
         * Function executed before get holding time slot.
         */
        function onBeforeHoldDate(params){
            var product=vm.product;
            var people = {};
            for(var x=0; x<vm.details.length; x++){
                people[vm.details[x].id] = vm.details[x].selected;
            }
            params.people = people;
            var selectedDateFormatted = $filter('date')(vm.selectedDate, vm.dateFormat);
            reservationAPIFactory.hodl({apiKey: vm.apiKey, vendor: vm.vendor, id:vm.id, date:selectedDateFormatted, externalId: vm.externalId, eventId:params.eventId, people:params.people, currency: product.integration.fields.currency, country: product.address.country}).then(function(data){
                if(reservationAPIFactory.hold.status === 'Error'){
                    vm.holdStatus = 'Error';
                    vm.holdStatusMessage = reservationAPIFactory.hold.message;
                    vm.loader = false;
                }
                else {
                    vm.hold = reservationAPIFactory.hold;
                    vm.currency = vm.hold.totalPayable.currency || product.integration.fields.currency;
                    PaymentMethod.active.query().$promise.then(function(res){
                        var stripeId = '';
                        for(var x=0; x<res.length; x++){
                            if(res[x].name === 'Stripe'){
                                stripeId= res[x].email;
                                break;
                            }
                        }
                        var stripe = Stripe(stripeId);
                        var product = vm.product;
                        var v = vm.variant;
                        var paymentRequest = stripe.paymentRequest({
                            country: product.address.country === 'Canada' ? 'CA' : 'US',
                            currency: vm.hold.totalPayable.currency.toLowerCase() || product.integration.fields.currency.toLowerCase(),
                            total: {
                            label: v.name,
                            amount: +(vm.hold.totalPayable.amount * 100).toFixed(0),
                            },
                            requestPayerName: true,
                            requestPayerEmail: true,
                            requestPayerPhone: true
                        });
                        var elements = stripe.elements();
                        var prButton = elements.create('paymentRequestButton', {
                        style: {
                            paymentRequestButton: {
                                type: 'book',
                                theme: 'dark',
                            },
                        },
                        paymentRequest: paymentRequest,
                        });
                        // Check the availability of the Payment Request API first.
                        paymentRequest.canMakePayment().then(function(result) {
                            if (result) {
                                vm.showOr = true;
                                $rootScope.$apply();
                                prButton.mount('#payment-request-button');
                            } else {
                                vm.showOr = false;
                            }
                        });
                        paymentRequest.on('token', function(ev) {
                            onBeforeReserve(vm.selectedDate, vm.selectedHour, {
                                firstName: ev.payerName.split(' ')[0],
                                lastName: ev.payerName.split(' ')[1] || '',
                                phone: ev.payerPhone || "",
                                email: ev.payerEmail,
                            }, ev);
                        });
                        vm.selectedTab = 2;
                        //vm.userData.finalPrice = vm.hold.totalPayable.amount;
                        vm.loader = false;
                        vm.thirdTabLocked = false;
                    });
                }
            });
        }

        /**
         * Get available hours for a selected date
         */
        function getAvailableHours(params) {
            vm.minimumPeople = 0;
            var selectedDateFormatted = $filter('date')(new Date(params.date), vm.dateFormat);
            params.date = selectedDateFormatted;
            params.country = vm.product.address.country;
            reservationAPIFactory.getVendorAvailableHours(params).then(function (data) {
                vm.loader = false;
                vm.loaderFareharbor = false;
                var status = vm.availableHoursStatus = reservationAPIFactory.status || '';
                var message = vm.availableHoursMessage = reservationAPIFactory.message || '';

                //Completed get available hours callback
                //reservationService.onCompletedGetAvailableHours(status, message, date);
                vm.minimumPeople = reservationAPIFactory.availableHours && reservationAPIFactory.availableHours[0].min;
                if(params.vendor === 'fareharbor api'){
                    if(vm.details.length === 0){
                        vm.details = reservationAPIFactory.details;
                    }
                }

                vm.availableHours = reservationAPIFactory.availableHours.filter(function(item){
                    if(params.vendor === 'fareharbor api'){
                        return item.numSeatsAvailable >= vm.totalSelectedPeople && vm.totalSelectedPeople >= item.min;
                    }
                    else {
                        return item.numSeatsAvailable >= vm.totalSelectedPeople;
                    }
                });
                //Success
                if (status.toUpperCase() == 'SUCCESS') {
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
        function onBeforeReserve(date, hour, userData, ev) {
            var v = vm.variant, product=vm.product;
            //userData.finalPrice = vm.hold.totalPayable.amount;
            reservationService.onBeforeReserve(date, hour, userData).then(function (){
                $rootScope.cart.addItem({sku:v.experienceSku, businessId:product.businessId, name:v.name, slug:product.slug, mrp:v.mrp, price:v.price, quantity:1, image:v.image,category:product.category, currency:vm.hold.totalPayable.currency || product.integration.fields.currency, partner:product},true, false);
                var shipping = {
                    afterTax: parseFloat(vm.hold.totalPayable.amount),
                    charge: 0,
                    couponAmount: 0,
                    more: 999999,
                    tax: (vm.hold.price.totalTaxes.amount / vm.hold.price.totalNet.amount).toFixed(4) !== 1 ? 
                        (vm.hold.price.totalTaxes.amount / vm.hold.price.totalNet.amount).toFixed(4) :
                        0,
                    total: parseFloat(vm.hold.price.totalNet.amount),
                    holdId: vm.hold.id || vm.hold._id
                };
                var people = [];
                for (var x=0; x<vm.details.length; x++){
                    if(vm.details[x].selected > 0){
                        people.push({
                            name: vm.details[x].name,
                            quantity: vm.details[x].selected,
                            price: vm.details[x].price.amount
                        });
                    }
                }
                var data = {
                    tax: parseFloat(shipping.tax) !== 0 ? (parseFloat(shipping.tax) + 1) : 0,
                    businessId:product.businessId,
                    currency:vm.hold.totalPayable.currency || product.integration.fields.currency,
                    phone:userData.phone,
                    name:userData.firstName + ' ' + userData.lastName,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    payment:ev && ev.methodName || 'Stripe',
                    items:$rootScope.cart.items,
                    shipping:shipping,
                    email: userData.email.toLowerCase(),
                    people: people,
                    entered: {
                        status: true,
                        date: Date.now(),
                        bookingDate: vm.selectedDate,
                        bookingTime: vm.selectedHour
                    }
                };
                Order.widget.save(data, function(data){
                    var obj = {};
                    obj.status = {};
                    obj.status.name = vm.toTitleCase(data.items[0].partner.integration.name) + ' Stripe Modal Incomplete';
                    obj.status.val = 150;
                    obj.phone = userData.phone;
                    Order.widget.updateStatus.update({id:data.transactionId}, obj);
                    if(ev) {
                        var order = {
                            token: ev.token.id,
                            amount: vm.hold.totalPayable.amount,
                            currency: vm.hold.totalPayable.currency || product.integration.fields.currency,
                            description: v.name,
                            items: [{sku: v.experienceSku}],
                            transactionId: data.transactionId,
                            businessId : product.businessId,
                            customerEmail: vm.userData.email,
                            integration: true,
                            holdId: vm.hold.id,
                            total: vm.hold.totalPayable.amount,
                            integrationName: product.integration.name
                        }
                        _Stripe.save(order, function(checkout){
                            ev.complete('success');
                            $.blockUI({
                                message: 'Processing order...',
                                css: {
                                  border: 'none',
                                  padding: '15px',
                                  backgroundColor: 'rgba(0,0,0,0.65)',
                                  '-webkit-border-radius': '10px',
                                  '-moz-border-radius': '10px',
                                  color: '#fff'
                                }
                            });
                            ga('send', 'event', 'Stripe Purchase', 'purchase');
                            ga('require', 'ecommerce');
                            ga('ecommerce:addTransaction', {
                                'id': checkout.metadata.transactionId,
                                'affiliation': 'Hijinks',
                                'revenue': checkout.amount / 100,
                                'shipping': '0',
                                'tax': (checkout.amount/100) - order.amount,
                                'currency': order.currency
                            });
                            ga('ecommerce:addItem', {
                                'id': checkout.metadata.transactionId,
                                'name': order.description,
                                'sku': order.items[0].sku,
                                'category': product.category.name,
                                'price': vm.hold.totalPayable.amount,
                                'quantity': vm.totalSelectedPeople,
                                'currency': order.currency
                            });
                            ga('ecommerce:send');
                            fbq('track', 'Purchase', {
                                content_name: checkout.description,
                                content_category: product.category.name,
                                content_ids: [order._id, order.items[0].sku],
                                value: checkout.amount / 100,
                                currency: order.currency
                            });
                            if (localStorage !== null) {
                                localStorage['transactionId'] = checkout.metadata.transactionId;
                                localStorage['tempTransactionId'] = '';
                            }
                            $rootScope.transactionId = checkout.metadata.transactionId;
                            if(checkout.status === 'Error'){
                                var status = vm.reservationStatus = checkout.status;
                                var message = vm.reservationMessage = checkout.message;
                            }
                            else {
                                if(checkout.status === 'succeeded'){
                                    reserve(date, hour, userData, data.transactionId);
                                }
                                else {
                                    var status = vm.reservationStatus = checkout.status;
                                    var message = vm.reservationMessage = checkout.message;
                                }
                            }
                        }, function(error){
                            ev.complete('fail');
                        });
                    }
                    else {
                        var paymentMethod = {};
                        PaymentMethod.active.query().$promise.then(function(res){
                            for(var x=0; x<res.length; x++){
                                if(res[x].name === 'Stripe'){
                                    paymentMethod = res[x];
                                }
                            }
                            $rootScope.cart.checkout({paymentMethod:paymentMethod, transactionId:data.transactionId, email:userData.email, currency:$rootScope.cart.items[0].currency || product.integration.fields.currency, options: shipping, integration: data.items[0].partner.integration.name.toLowerCase()},true, function(checkout){
                                if(checkout.status === 'Error'){
                                    var status = vm.reservationStatus = checkout.status;
                                    var message = vm.reservationMessage = checkout.message;
                                }
                                else {
                                    if(checkout.status === 'succeeded'){
                                        reserve(date, hour, userData, data.transactionId);
                                    }
                                    else {
                                        var status = vm.reservationStatus = checkout.status;
                                        var message = vm.reservationMessage = checkout.message;
                                    }
                                }
                            });
                        });
                    }
                }, function(err){
                    $scope.err = "There was an error confirming your purchase. Try refreshing the page or send us an email. Sorry about that!";
                });
                

            }, function() {
                console.log("onBeforeReserve: Rejected promise");
            });
        }

        function removeHold(){
            if(vm.vendor === 'bookeo'){
                return reservationAPIFactory.cancelHold({apiKey: vm.apiKey, id: vm.hold.id, vendor: vm.vendor});
            }
            else {
                return new Promise(function(resolve, reject){
                    resolve('true');
                });
            }
        }

        /**
         * Do reserve POST with selectedDate, selectedHour and userData as parameters of the call
         */
        // TODO This function should have all needed parameters in order to test it better
        function reserve(date, hour, userData, transactionId) {
            // vm.loader = true;

            var selectedDateFormatted = $filter('date')(date, vm.dateFormat);
            var people = {};
            if(vm.vendor === 'bookeo'){
                for(var x=0; x<vm.details.length; x++){
                    people[vm.details[x].id] = {
                        selected: vm.details[x].selected,
                        price: vm.details[x].price.amount
                    };
                }
            }
            var params = {transactionId: transactionId, selectedDate: selectedDateFormatted, selectedHour: hour, userData: userData, holdId: vm.hold.id, timeSlot: vm.selectedSlot, apiKey: vm.apiKey, vendor: vm.vendor, id: vm.id, externalId: vm.externalId, people:people, title: vm.details[0].title, country: vm.product.address.country};
            reservationAPIFactory.reserve(params).then(function () {
                vm.loader = false;

                var status = vm.reservationStatus = reservationAPIFactory.status;
                var message = vm.reservationMessage = reservationAPIFactory.message;

                //Completed reserve callback
                
                
                //Success
                if (status === 'Success') {
                    //Successful reserve calback
                    reservationService.onCompletedReserve(status, message, date, hour, userData);
                    $window.location ='/purchase-complete';

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
                currency: '@',
                customMonth: '&',
                user: '@',
                fetchingAvailability: '='

            },
            controller: 'ReservationCtrl',
            controllerAs: 'reservationCtrl',
            templateUrl: 'index.html'
        };
    }])
    .directive('phoneInput', function($filter, $browser) {
        return {
            require: 'ngModel',
            link: function($scope, $element, $attrs, ngModelCtrl) {
                var listener = function() {
                    var value = $element.val().replace(/[^0-9]/g, '');
                    $element.val($filter('tel')(value, false));
                };

                // This runs when we update the text field
                ngModelCtrl.$parsers.push(function(viewValue) {
                    return viewValue.replace(/[^0-9]/g, '').slice(0,10);
                });

                // This runs when the model gets updated on the scope directly and keeps our view in sync
                ngModelCtrl.$render = function() {
                    $element.val($filter('tel')(ngModelCtrl.$viewValue, false));
                };

                $element.bind('change', listener);
                $element.bind('keydown', function(event) {
                    var key = event.keyCode;
                    // If the keys include the CTRL, SHIFT, ALT, or META keys, or the arrow keys, do nothing.
                    // This lets us support copy and paste too
                    if (key == 91 || (15 < key && key < 19) || (37 <= key && key <= 40)){
                        return;
                    }
                    $browser.defer(listener); // Have to do this or changes don't get picked up properly
                });

                $element.bind('paste cut', function() {
                    $browser.defer(listener);
                });
            }

        };
    });

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
                reservationAPI.status = response.data.status || '';
                reservationAPI.message = response.data.message || '';
                if(params.vendor === 'fareharbor api'){
                    reservationAPI.details = response.data.people;
                    reservationAPI.availableHours = response.data.times;
                }
                else if(params.vendor === 'bookeo'){
                    reservationAPI.availableHours = response.data.data;
                }

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
                //console.log(response.data);
                reservationAPI.hold = response.data;
                //validateReserveResponseData(response.data);
                //reservationAPI.status = response.data.status;
                //reservationAPI.message = response.data.message;

            }, function(response) {
                reservationAPI.errorManagement(response.status);
            });
        }

        //Call to create temporary hold before finalizing booking
        reservationAPI.cancelHold = function(params){
           return $http({
                method: 'PUT',
                data: params,
                url: reservationConfig.holdSlotAPIUrl,
                responseType: 'json'
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
                //console.log(response.data);
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
        var newDate = new Date(val.replace('T', ' ').replace(/-/g,'/').slice(0, -6));
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
            //console.log("Executing before get available hours callback");
            var deferred = $q.defer();

            deferred.resolve();
            //deferred.reject();

            return deferred.promise;
        }

        //Completed get available hours callback
        this.onCompletedGetAvailableHours = function(status, message, selectedDate) {
            //console.log("Executing completed get available hours callback");
        }

        //Success get available hours callback
        this.onSuccessfulGetAvailableHours = function(status, message, selectedDate, availableHours) {
            //console.log("Executing successful get available hours callback");
        }

        //Error get available hours callback
        this.onErrorGetAvailableHours = function(status, message, selectedDate) {
            //console.log("Executing error get available hours callback");
        }

        //Before reserve callback
        this.onBeforeReserve = function(selectedDate, selectedHour, userData) {
            //console.log("Executing before reserve callback");
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
            //console.log("Executing completed reserve callback");
        }

        //Success reserve callback
        this.onSuccessfulReserve = function(status, message, reservedDate, reservedHour, userData) {
            //console.log("Executing successful reserve callback");
        }

        //Error reserve callback
        this.onErrorReserve = function(status, message, selectedDate, selectedHour, userData) {
            //console.log("Executing error reserve callback");
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
                //console.log("Accepted");
                deferred.resolve();

            }, function () {
                //console.log("Cancelled");
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
            client: "Details",
            payment: 'Payment',
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
            reserve: "Review my purchase »",
            confirmOK: "Checkout",
            confirmCancel: "No, cancel",
            confirmTitle: "Confirm reservation",
            confirmText: "{{name}}, are you sure you want to reserve date {{selectedDate | date : 'shortDate'}} at {{selectedHour}}?",
            noAvailableHours: "There’s no availability for a group of your size on this day. Please select another date."
        });

        $translateProvider.translations('es', {
            date: "Fecha",
            time: "Hora",
            client: "Cliente",
            payment: 'Payment',
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
angular.module("hm.reservation").run(["$templateCache", function($templateCache) {$templateCache.put("availableHours.html","<h4 style=\"margin-left:-15px\">Select time</h4>\n<div class=\"row clickable\">\n	<a class=\"list-group-item\" style=\"position:relative\" ng-repeat=\"item in reservationCtrl.availableHours\" ng-click=\"reservationCtrl.selectHour(item)\"\n	   ng-class=\"{\'angular-reservation-selected\': reservationCtrl.selectedHour == item}\">\n	    <div style=\"display:inline-block\"><span>{{::item.startTime | ignoreTimeZone | date  : \'shortTime\'}}{{::(item.endTime && item.endTime !== item.startTime) ? \' - \' : \'\'}}<span ng-if=\"::item.endTime !== item.startTime\">{{::item.endTime | ignoreTimeZone | date  : \'shortTime\'}}</span></span><div class=\"hijinks-orange bold\" ng-if=\"item.numSeatsAvailable < 5\">Only {{::item.numSeatsAvailable}} left!</div></div>\n	    <!--<div style=\"display:inline-block;float:right\"><span></span></div>-->\n	    <span style=\"display:inline-block;float:right\"><span style=\"position:absolute; right:15px; top:50%; margin-top:-15px; font-size: 13px;\" class=\"btn btn-success btn-sm\">SELECT</span></span>\n	</a>\n  <div uib-alert class=\"alert-danger text-center\" ng-if=\"reservationCtrl.holdStatus == \'Error\'\" style=\"margin-top: 1em\">\n      <div ng-if=\"reservationCtrl.holdStatusMessage\">{{::reservationCtrl.holdStatusMessage}}</div>\n  </div>\n  <div>\n		<a class=\"text-muted\" ng-if=\"reservationCtrl.holdStatus !== \'Error\'\" ng-click=\"reservationCtrl.selectAnotherDate()\">« Select another date</a>\n		<a class=\"btn btn-purchase\" ng-if=\"reservationCtrl.holdStatus === \'Error\'\" ng-click=\"reservationCtrl.selectAnotherDate()\">« Select another date</a>\n  </div>\n</div>\n<div class=\"row\" style=\"margin-top:20px;border-top: 1px solid #f6f6f6;margin-left:-30px;margin-right:-30px; margin-bottom:-20px\">\n	<div class=\"col-md-12\">\n		<h6 class=\"text-muted\">YOU\'RE BOOKING</h6>\n		<h4>{{::reservationCtrl.experienceTitle}}</h4>\n		<div style=\"height:20px\">\n			<span class=\"pull-left\"><i class=\"fa fa-fw fa-user accent\"></i> {{::reservationCtrl.totalSelectedPeople}} tickets</span>\n			<span class=\"pull-right\"><i class=\"fa fa-fw fa-calendar accent\"></i> {{::reservationCtrl.selectedDate | date}}</span>\n		</div>\n		<div style=\"margin-top:5px\" ng-if=\"reservationCtrl.totalAmount && reservationCtrl.details[0].flatFee !== true\">\n			<span class=\"pull-left\"><i class=\"fa fa-fw fa-money accent\"></i> {{::reservationCtrl.currency.substring(0,2)}} {{::reservationCtrl.totalAmount | currency}}</span>\n		</div>\n		<div style=\"margin-top:5px\" ng-if=\"reservationCtrl.totalAmount && reservationCtrl.details[0].flatFee === true\">\n			<span class=\"pull-left\"><i class=\"fa fa-fw fa-money accent\"></i> {{::reservationCtrl.currency.substring(0,2)}} {{::reservationCtrl.details[0].price.amount | currency}}</span>\n		</div>\n	</div>\n</div>");
$templateCache.put("clientForm.html","<div class=\"angular-reservation-clientForm\">\n    <div class=\"col-md-12 buffer-bottom\">\n        <h6 class=\"text-muted\">YOU\'RE BOOKING</h6>\n        <h4>{{reservationCtrl.experienceTitle}}</h4>\n        <div style=\"display:flex; align-items: baseline\">\n            <span class=\"accent\" style=\"margin-top:-4px; font-size: 28px\" ng-if=\"reservationCtrl.totalAmount\">{{::reservationCtrl.currency.substring(0,2)}} {{::reservationCtrl.hold.price.totalGross.amount | currency}}</span>\n            <!-- <span style=\"margin-left: 5px\" class=\"text-muted\">incl. taxes</span> -->\n            <span class=\"pull-right hijinks-orange clickable\" ng-click=\"reservationCtrl.showBreakdown = !reservationCtrl.showBreakdown\" style=\"font-size: 10px; display:flex; flex:2; justify-content: flex-end\">{{reservationCtrl.showBreakdown ? \'HIDE\' : \'VIEW\'}} DETAILS</span>\n        </div>\n        <div ng-if=\"reservationCtrl.showBreakdown\">\n            <div class=\"angular-reservation-breakdown\">\n                <div style=\"padding: 10px;\">\n                    <div ng-repeat=\"person in reservationCtrl.details\" ng-if=\"reservationCtrl.details[0].flatFee !== true\">\n                        <span style=\"width:80%\" ng-if=\"reservationCtrl.details[$index].selected > 0\">{{::person.name}} x {{::reservationCtrl.details[$index].selected}}</span>\n                        <span class=\"pull-right text-muted\" ng-if=\"reservationCtrl.details[$index].selected > 0  && person.price.amount\">{{::reservationCtrl.hold.price.totalGross.amount | currency}}</span>\n                    </div>\n                    <hr style=\"margin: 10px -10px\" ng-if=\"reservationCtrl.details[0].flatFee !== true\"/>\n                    <div>\n                        <span>Taxes & Fees</span>\n                        <span class=\"pull-right text-muted\">{{::reservationCtrl.hold.price.totalTaxes.amount | currency}}</span>\n                    </div>\n                    <div>\n                        <span>Total </span>\n                        <span class=\"pull-right text-muted\">{{::reservationCtrl.hold.price.totalGross.amount | currency}}</span>\n                    </div>\n                </div>\n            </div>\n        </div>\n        <div style=\"height:20px\">\n            <span class=\"pull-left\"><i class=\"fa fa-calendar accent\"></i> {{::reservationCtrl.selectedDate | date}}</span>\n            <span class=\"pull-right\"><i style=\"width:13px; text-align: center\" class=\"fa fa-clock-o accent\"></i> {{::reservationCtrl.selectedHour}}</span>\n        </div>\n    </div>\n    <div class=\"col-md-12\" ng-if=\"reservationCtrl.showOr\">\n        <div id=\"payment-request-button\"></div>\n        <h4 class=\"text-center\" style=\"margin:30px 0 15px 0\">Or enter payment details below</h4>\n    </div>\n    <div class=\"col-md-12 buffer-bottom\">\n        <div class=\"row\">\n            <div class=\"col-md-12\">\n                <div class=\"input-group\">\n                <span class=\"input-group-addon\">\n                    <span class=\"fa fa-user\" aria-hidden=\"true\" style=\"font-size: 14px\"></span>\n                </span>\n\n                    <input id=\"firstName\" name=\"firstName\" class=\"form-control\" placeholder=\"First Name\" type=\"text\" ng-model=\"reservationCtrl.userData.firstName\"\n                        autofocus=\"true\" ng-pattern=\"/^[\\w\\s\\-\\x7f-\\xff]*$/\" ng-minlength=\"2\" ng-maxlength=\"100\" required>\n                </div>\n\n                <div ng-messages=\"reserveForm.firstName.$error\" ng-if=\"reserveForm.$submitted\">\n                    <span ng-message=\"minlength\" class=\"text-danger\">{{::\"minLength\" | translate: \'{minLength: \"2\"}\'}}</span>\n                    <span ng-message=\"maxlength\" class=\"text-danger\">{{::\"maxLength\" | translate: \'{maxLength: \"100\"}\'}}</span>\n                    <span ng-message=\"pattern\" class=\"text-danger\">{{::\"invalidCharacters\" | translate}}</span>\n                    <span ng-message=\"required\" class=\"text-danger\">{{::\"required\" | translate}}</span>\n                </div>\n            </div>\n        </div>\n    </div>\n\n    <div class=\"col-md-12 buffer-bottom\">\n        <div class=\"row\">\n            <div class=\"col-md-12\">\n                <div class=\"input-group\">\n                <span class=\"input-group-addon\">\n                    <span class=\"fa fa-user\" aria-hidden=\"true\" style=\"font-size: 14px\"></span>\n                </span>\n\n                    <input id=\"lastName\" name=\"lastName\" class=\"form-control\" placeholder=\"Last Name\" type=\"text\" ng-model=\"reservationCtrl.userData.lastName\"\n                        autofocus=\"true\" ng-pattern=\"/^[\\w\\s\\-\\x7f-\\xff]*$/\" ng-minlength=\"2\" ng-maxlength=\"100\" required>\n                </div>\n\n                <div ng-messages=\"reserveForm.lastName.$error\" ng-if=\"reserveForm.$submitted\">\n                    <span ng-message=\"minlength\" class=\"text-danger\">{{::\"minLength\" | translate: \'{minLength: \"2\"}\'}}</span>\n                    <span ng-message=\"maxlength\" class=\"text-danger\">{{::\"maxLength\" | translate: \'{maxLength: \"100\"}\'}}</span>\n                    <span ng-message=\"pattern\" class=\"text-danger\">{{::\"invalidCharacters\" | translate}}</span>\n                    <span ng-message=\"required\" class=\"text-danger\">{{::\"required\" | translate}}</span>\n                </div>\n            </div>\n        </div>\n    </div>\n\n    <div class=\"col-md-12 buffer-bottom\">\n        <div class=\"row\">\n            <div class=\"col-md-12\">\n                <div class=\"input-group\">\n                <span class=\"input-group-addon\">\n                    <span class=\"fa fa-phone\" aria-hidden=\"true\" style=\"font-size: 14px\"></span>\n                </span>\n\n                    <input id=\"phone\" name=\"phone\" class=\"form-control\" placeholder=\"{{::\'phone\' | translate}}\" type=\"tel\" ng-model=\"reservationCtrl.userData.phone\" ng-minlength=\"10\" ng-maxlength=\"15\" required>\n                </div>\n\n                <div ng-messages=\"reserveForm.phone.$error\" ng-if=\"reserveForm.$submitted\">\n                    <span ng-message=\"minlength\" class=\"text-danger\">{{::\"minLength\" | translate: \'{minLength: \"10\"}\'}}</span>\n                    <span ng-message=\"maxlength\" class=\"text-danger\">{{::\"maxLength\" | translate: \'{maxLength: \"15\"}\'}}</span>\n                    <span ng-message=\"pattern\" class=\"text-danger\">{{::\"invalidPhone\" | translate}}</span>\n                    <span ng-message=\"required\" class=\"text-danger\">{{::\"required\" | translate}}</span>\n                </div>\n            </div>\n        </div>\n    </div>\n\n    <div class=\"col-md-12 buffer-bottom\">\n        <div class=\"row\">\n            <div class=\"col-md-12\">\n                <div class=\"input-group\">\n                <span class=\"input-group-addon\">\n                    <span class=\"fa fa-envelope\" aria-hidden=\"true\" style=\"font-size: 14px\"></span>\n                </span>\n\n                    <input id=\"email\" name=\"email\" class=\"form-control\" placeholder=\"{{::\'email\' | translate}}\" type=\"email\" ng-model=\"reservationCtrl.userData.email\"\n                        ng-pattern=\"/[\\w|.|-]*@\\w*\\.[\\w|.]*/\" required>\n                </div>\n\n                <div ng-messages=\"reserveForm.email.$error\" ng-if=\"reserveForm.$submitted\">\n                    <span ng-message=\"pattern\" class=\"text-danger\">{{::\"invalidEmail\" | translate}}</span>\n                    <span ng-message=\"required\" class=\"text-danger\">{{::\"required\" | translate}}</span>\n                </div>\n            </div>\n        </div>\n    </div>\n\n    <div class=\"col-md-12 text-center\" style=\"padding-bottom:10px\">\n        <button ng-disabled=\"reserveForm.$invalid\" class=\"btn btn-danger btn-lg\" style=\"font-size: 16px; width:100%; border: none;\" type=\"submit\" ng-click=\"reservationCtrl.reserve(reservationCtrl.selectedDate, reservationCtrl.selectedHour, reservationCtrl.userData)\">{{::\"confirmOK\" | translate}}</button>\n        <div style=\"padding-top:10px\"><a class=\"clickable text-muted\" ng-click=\"reservationCtrl.setSummary(false);\">« Edit booking details</a></div>\n    </div>\n\n    <div class=\"col-md-12\">\n        <div uib-alert class=\"alert-success text-center\" ng-if=\"reservationCtrl.reservationStatus == \'Success\'\" style=\"margin-top: 1em\">\n            <span>Success!</span>\n            <div ng-if=\"reservationCtrl.reservationMessage\">{{::reservationCtrl.reservationMessage}}</div>\n        </div>\n\n        <div uib-alert class=\"alert-danger text-center\" ng-if=\"reservationCtrl.reservationStatus == \'Error\'\" style=\"margin-top: 1em\">\n            <div ng-if=\"reservationCtrl.reservationMessage\">{{::reservationCtrl.reservationMessage}}</div>\n            <span>Please contact your financial institution for support.</span>\n        </div>\n    </div>\n</div>");
$templateCache.put("confirmationModal.html","<div class=\"modal-header\">\n    <h3 class=\"modal-title\">{{::\"confirmTitle\" | translate}}</h3>\n</div>\n\n<div class=\"modal-body\">\n    <h5>{{::\"confirmText\" | translate : confirmationModalCtrl.translationParams}}</h5>\n\n    <div ng-repeat=\"(key, value) in confirmationModalCtrl.userData track by $index\" ng-if=\"key !== \'transactionId\'\">\n        <label class=\"control-label text-muted\">{{::key | translate}}:</label>\n		\n        <h5 ng-if=\"key!==\'finalPrice\'\" class=\"angular-reservation-h5\">{{::value}}</h5>\n        <h5 ng-if=\"key===\'finalPrice\'\" class=\"angular-reservation-h5\">{{::value | currency}}</h5>\n    </div>\n</div>\n\n<div class=\"modal-footer\">\n    <button class=\"btn btn-danger\" type=\"button\" ng-click=\"$dismiss()\">{{::\"confirmCancel\" | translate}}</button>\n    <button class=\"btn btn-success\" type=\"button\" ng-click=\"$close()\">{{::\"confirmOK\" | translate}}</button>\n</div>");
$templateCache.put("datepicker.html","<div class=\"row\">\n	<div class=\"col-md-12\">\n		<h4 style=\"width:95%;margin-left:auto;margin-right:auto;\">Select date & participants</h4>\n		<div class=\"angular-reservation-live\" ng-if=\"!fetchingAvailability\"><i class=\"fa fa-check\"></i> Live Availability</div>\n		<div class=\"angular-reservation-loading\" ng-if=\"fetchingAvailability\"><i class=\"fa fa-spinner fa-pulse fa-fw\"></i> Getting availability...</div>\n		<div uib-datepicker class=\"angular-reservation-datepicker\" ng-change=\"reservationCtrl.update(reservationCtrl.selectedDate)\" ng-model=\"reservationCtrl.selectedDate\" datepicker-options=\"reservationCtrl.datepickerOptions\"></div>\n		<div ng-if=\"!reservationCtrl.details\" style=\"width:95%; margin: 0 auto;\"><span class=\"angular-reservation-live\">Click a date to browse availability</span></div>\n	</div>\n\n	<div class=\"col-md-12\">\n		<div ng-include=\"\'loader.html\'\" class=\"text-center buffer-bottom\" ng-if=\"reservationCtrl.loaderFareharbor\"></div>\n		<div ng-repeat=\"person in reservationCtrl.details\">\n			<div class=\"row angular-reservation-padding\">\n				<div class=\"col-xs-12\" style=\"margin-bottom:10px\">\n					<div style=\"display:inline-block;width:60%\">{{::person.name}} <span ng-if=\"person.price.amount\" class=\"text-muted \">{{::person.price.amount  | currency}}</span><span ng-if=\"!person.price.amount\" class=\"text-muted \">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>\n						<span class=\"person-note text-muted\" ng-if=\"person.note\">{{::person.note}}</span>\n					</div>\n			    <select class=\"pull-right angular-reservation-dropdown\" ng-model=\"reservationCtrl.details[$index].selected\" ng-change=\"reservationCtrl.details[$parent.$index].selected = o; reservationCtrl.selectedPeople=true\">\n			    	<option value=\" \">Select</option>\n	     			<option ng-value=\"o\" ng-repeat=\"o in reservationCtrl.range(reservationCtrl.details[$index].min, reservationCtrl.details[$index].max)\">{{::o}}</option>\n	     		</select>\n				</div>\n			</div>\n		</div>\n		<div uib-alert class=\"alert-danger text-center\" ng-if=\"reservationCtrl.detailsError\" style=\"margin-top: 1em\">\n            <div>Oh no! There\'s a glitch in the system. Contact us for help at info@hijinkslife.com</div>\n        </div>\n		<div style=\"padding:20px 0; margin: 0 auto; width:95%\">\n			<span ng-if=\"reservationCtrl.minimumPeople > 1 && reservationCtrl.getTotalPeople() < reservationCtrl.minimumPeople\" style=\"display:block;margin-bottom: 10px; color:firebrick\">A minimum of {{::reservationCtrl.minimumPeople}} is required to make this booking</span>\n			<a ng-disabled=\"!reservationCtrl.selectedPeople || reservationCtrl.dateDisabled || (reservationCtrl.minimumPeople > 1 && reservationCtrl.getTotalPeople() < reservationCtrl.minimumPeople)\" ng-click=\"reservationCtrl.onSelectDate(reservationCtrl.selectedDate)\" style=\"border-radius: 0; font-size: 17px\" class=\"btn btn-success btn-block text-center\">Next »</a>\n		</div>\n	</div>\n</div>");
$templateCache.put("index.html","<div class=\"outlined\" ng-init=\"reservationCtrl.getDetails()\">\n    <uib-tabset active=\"reservationCtrl.selectedTab\" justified=\"true\" class=\"angular-reservation-bump\" ng-click=\"reservationCtrl.holdStatus=\'\'\">\n        <uib-tab ng-click=\"reservationCtrl.loader = false\" index=\"0\" style=\"border-radius:0;\">\n            <uib-tab-heading>\n                <span class=\"fa fa-calendar\" aria-hidden=\"true\" class=\"angular-reservation-icon-size\"></span>\n                <h5>{{::\"date\" | translate}}</h5>\n                <!--<h5 ng-if=\"!reservationCtrl.secondTabLocked\">{{reservationCtrl.selectedDate | date: reservationCtrl.dateFormat}}</h5>-->\n            </uib-tab-heading>\n            <div class=\"spacer\" ng-if=\"reservationCtrl.loader\"></div>\n            <div ng-include=\"\'loader.html\'\" class=\"text-center buffer-top\" style=\"padding-bottom:10px\" ng-if=\"reservationCtrl.loader\"></div>\n            <div ng-include=\"reservationCtrl.datepickerTemplate\"></div>\n        </uib-tab>\n\n        <uib-tab ng-click=\"!reservationCtrl.secondTabLocked && reservationCtrl.onSelectDate(reservationCtrl.selectedDate)\" index=\"1\" disable=\"reservationCtrl.secondTabLocked\">\n            <uib-tab-heading>\n                <span class=\"fa fa-clock-o\" aria-hidden=\"true\" class=\"angular-reservation-icon-size\"></span>\n                <h5>{{::\"time\" | translate}}</h5>\n                <!--<h5 ng-if=\"!reservationCtrl.thirdTabLocked\">{{reservationCtrl.selectedHour}}</h5>-->\n            </uib-tab-heading>\n\n            <div class=\"spacer\" ng-if=\"reservationCtrl.loader || reservationCtrl.loaderFareharbor\"></div>\n            <div style=\"padding-bottom: 10px\" ng-include=\"\'loader.html\'\" class=\"text-center\" ng-if=\"reservationCtrl.loader\"></div>\n\n            <div class=\"angular-reservation-availableHour\" ng-if=\"!reservationCtrl.loader && reservationCtrl.availableHours.length > 0\">\n                <div ng-include=\"reservationCtrl.availableHoursTemplate\"></div>\n            </div>\n\n            <div ng-if=\"!reservationCtrl.loader && (reservationCtrl.availableHours.length == 0)\">\n                <div ng-include=\"reservationCtrl.noAvailableHoursTemplate\"></div>\n            </div>\n            <div style=\"padding-bottom: 10px\" ng-include=\"\'loader.html\'\" class=\"text-center\" ng-if=\"reservationCtrl.loaderFareharbor\"></div>\n        </uib-tab>\n\n        <uib-tab index=\"2\" disable=\"reservationCtrl.thirdTabLocked\">\n            <uib-tab-heading>\n                <span class=\"fa fa-credit-card\" aria-hidden=\"true\" class=\"angular-reservation-icon-size\"></span>\n                <h5>{{::\"payment\" | translate}}</h5>\n            </uib-tab-heading>\n    \n            <div >\n                <form class=\"form-horizontal\" name=\"reserveForm\" novalidate\n                      >\n                    <div class=\"spacer\" ng-if=\"reservationCtrl.loader\"></div>\n                    <div ng-include=\"\'loader.html\'\" class=\"text-center\" ng-if=\"reservationCtrl.loader\"></div>\n\n                    <fieldset ng-if=\"!reservationCtrl.loader\">\n                        <div ng-include=\"reservationCtrl.clientFormTemplate\"></div>\n                    </fieldset>\n                </form>\n            </div>\n\n            <!-- <div ng-if=\"reservationCtrl.showSummary\" class=\"angular-reservation-show-500\">\n                <div class=\"spacer\"/>\n                <div class=\"col-md-12 text-muted angular-reservation-detail-title\">Experience</div>\n                <div class=\"col-md-12 angular-reservation-detail\"><span class=\"angular-reservation-underline\">{{::reservationCtrl.experienceTitle}}</span></div>\n                <div class=\"col-md-12 text-muted angular-reservation-detail-title\">Date</div>\n                <div class=\"col-md-12 angular-reservation-detail\"><span class=\"angular-reservation-underline\">{{::reservationCtrl.selectedDate | date}} at {{::reservationCtrl.selectedHour}}</span></div>\n                <div ng-repeat=\"(key, value) in reservationCtrl.userData track by $index\">\n                    <div class=\"col-md-12 text-muted angular-reservation-detail-title\">{{::key | translate}}</div>\n                    <div class=\"col-md-12 angular-reservation-detail\" style=\"word-break: break-all\"><span class=\"angular-reservation-underline\">{{::value}}</span></div>\n                </div>\n                <div class=\"modal-footer\" style=\"text-align:left\">\n                    <div>\n                        <div ng-repeat=\"person in reservationCtrl.details\">\n                            <span ng-if=\"reservationCtrl.details[$index].selected > 0\" style=\"font-size:16px\">{{::person.name}} x {{::reservationCtrl.details[$index].selected}}</span>\n                            <span class=\"pull-right text-muted\" style=\"font-size:16px\" ng-if=\"reservationCtrl.details[$index].selected > 0 && person.price.amount\">{{::(person.price.amount * reservationCtrl.details[$index].selected) | currency}}</span>\n                        </div>\n                        <hr/>\n                        <div class=\"text-right\">\n                            <span>Subtotal </span>\n                            <span class=\"text-muted\">{{::reservationCtrl.hold.price.totalNet.amount | currency}}</span>\n                        </div>\n                        <div class=\"text-right\" style=\"padding-bottom:10px\">\n                            <span>Tax</span>\n                            <span class=\"text-muted\">{{::reservationCtrl.hold.price.totalTaxes.amount | currency}}</span>\n                        </div>\n                        <div class=\"text-right\" style=\"font-size:20px\">\n                            <span>Total </span>\n                            <span class=\"hijinks-orange\">{{::reservationCtrl.hold.price.totalGross.amount | currency}}</span>\n                        </div>\n                    </div>\n                    <div class=\"spacer\"/>\n                    <div class=\"text-center\">\n                        <button class=\"btn btn-success btn-lg\" type=\"button\" ng-click=\"reservationCtrl.reserve(reservationCtrl.selectedDate, reservationCtrl.selectedHour, reservationCtrl.userData)\">{{::\"confirmOK\" | translate}}</button>\n                        <div style=\"padding-top:5px\"><a class=\"clickable text-muted\" ng-click=\"reservationCtrl.setSummary(false);\">« Edit booking details</a></div>\n                    </div>\n                </div>\n            </div>\n\n            <div ng-if=\"reservationCtrl.showSummary\" class=\"angular-reservation-hide-500\" >\n                <h4 style=\"width:95%;margin-left:auto;margin-right:auto;\">Review your purchase</h4>\n                <table class=\"angular-reservation-table\">\n                    <tr class=\"angular-reservation-tr\">\n                        <td><span class=\"text-muted\">Experience:</span></td>\n                        <td class=\"angular-reservation-td\"><span>{{::reservationCtrl.experienceTitle}}</span></td>\n                    </tr>\n                    <tr class=\"angular-reservation-tr\">\n                        <td><span class=\"text-muted\">Date:</span></td>\n                        <td class=\"angular-reservation-td\"><span>{{::reservationCtrl.selectedDate | date}} at {{::reservationCtrl.selectedHour}}</span></td>\n                    </tr>\n                    <tr class=\"angular-reservation-tr\" ng-repeat=\"(key, value) in reservationCtrl.userData track by $index\">\n                        <td><span class=\"text-muted\">{{::key | translate}}:</span></td>\n                        <td class=\"angular-reservation-td\">\n                            <span style=\"word-break:break-all\">{{::value}}</span>\n                        </td>\n                    </tr>\n                </table>\n\n                <div class=\"modal-footer\" style=\"text-align:left\">\n                    <div style=\"padding: 0 0 40px 0;\">\n                        <div ng-repeat=\"person in reservationCtrl.details\" ng-if=\"reservationCtrl.details[0].flatFee !== true\">\n                            <span ng-if=\"reservationCtrl.details[$index].selected > 0\">{{::person.name}} x {{::reservationCtrl.details[$index].selected}}</span>\n                            <span class=\"pull-right text-muted\" ng-if=\"reservationCtrl.details[$index].selected > 0  && person.price.amount\">{{::(person.price.amount * reservationCtrl.details[$index].selected) | currency}}</span>\n                        </div>\n                        <hr style=\"margin-right:-20px;margin-left:-20px\" ng-if=\"reservationCtrl.details[0].flatFee !== true\"/>\n                        <div class=\"text-right\">\n                            <span>Subtotal </span>\n                            <span class=\"text-muted\">{{::reservationCtrl.hold.price.totalNet.amount | currency}}</span>\n                        </div>\n                        <div class=\"text-right\" style=\"padding-bottom:10px\">\n                            <span>Taxes & Fees</span>\n                            <span class=\"text-muted\">{{::reservationCtrl.hold.price.totalTaxes.amount | currency}}</span>\n                        </div>\n                        <div class=\"text-right\" style=\"font-size:20px\">\n                            <span>Total </span>\n                            <span class=\"hijinks-orange\">{{::reservationCtrl.hold.price.totalGross.amount | currency}}</span>\n                        </div>\n                    </div>\n                    <div class=\"text-center\">\n                        <div id=\"payment-request-button\"></div>\n                        <h4 ng-if=\"reservationCtrl.showOr\" class=\"line text-muted\" style=\"margin:30px 0 30px 0\"><span class=\"line-text\">Or</span></h4>\n                        <button class=\"btn btn-danger btn-lg\" style=\"font-size: 16px; width:100%; border: none;\" type=\"button\" ng-click=\"reservationCtrl.reserve(reservationCtrl.selectedDate, reservationCtrl.selectedHour, reservationCtrl.userData)\">{{::\"confirmOK\" | translate}}</button>\n                        <div style=\"padding-top:5px\"><a class=\"clickable text-muted\" ng-click=\"reservationCtrl.setSummary(false);\">« Edit booking details</a></div>\n                    </div>\n                </div>\n            </div> -->\n        </uib-tab>\n    </uib-tabset>\n</div>\n");
$templateCache.put("loader.html","<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" version=\"1\" width=\"50px\" height=\"50px\" viewBox=\"0 0 28 28\">\n    <!-- 28= RADIUS*2 + STROKEWIDTH -->\n\n\n    <style type=\"text/css\">\n        /**************************/\n        /* STYLES FOR THE SPINNER */\n        /**************************/\n\n        /*\n         * Constants:\n         *      RADIUS      = 12.5\n         *      STROKEWIDTH = 3\n         *      ARCSIZE     = 270 degrees (amount of circle the arc takes up)\n         *      ARCTIME     = 1333ms (time it takes to expand and contract arc)\n         *      ARCSTARTROT = 216 degrees (how much the start location of the arc\n         *                                should rotate each time, 216 gives us a\n         *                                5 pointed star shape (it\'s 360/5 * 2).\n         *                                For a 7 pointed star, we might do\n         *                                360/7 * 3 = 154.286)\n         *\n         *      SHRINK_TIME = 400ms\n         */\n\n        .qp-circular-loader {\n            width:28px;  /* 2*RADIUS + STROKEWIDTH */\n            height:28px; /* 2*RADIUS + STROKEWIDTH */\n        }\n        .qp-circular-loader-path {\n            stroke-dasharray: 58.9;  /* 2*RADIUS*PI * ARCSIZE/360 */\n            stroke-dashoffset: 58.9; /* 2*RADIUS*PI * ARCSIZE/360 */\n            /* hides things initially */\n        }\n\n        /* SVG elements seem to have a different default origin */\n        .qp-circular-loader, .qp-circular-loader * {\n            -webkit-transform-origin: 50% 50%;\n            -moz-transform-origin: 50% 50%;\n        }\n\n        /* Rotating the whole thing */\n        @-webkit-keyframes rotate {\n            from {-webkit-transform: rotate(0deg);}\n            to {-webkit-transform: rotate(360deg);}\n        }\n        @-moz-keyframes rotate {\n            from {-webkit-transform: rotate(0deg);}\n            to {-webkit-transform: rotate(360deg);}\n        }\n        .qp-circular-loader {\n            -webkit-animation-name: rotate;\n            -webkit-animation-duration: 1568.63ms; /* 360 * ARCTIME / (ARCSTARTROT + (360-ARCSIZE)) */\n            -webkit-animation-iteration-count: infinite;\n            -webkit-animation-timing-function: linear;\n            -moz-animation-name: rotate;\n            -moz-animation-duration: 1568.63ms; /* 360 * ARCTIME / (ARCSTARTROT + (360-ARCSIZE)) */\n            -moz-animation-iteration-count: infinite;\n            -moz-animation-timing-function: linear;\n        }\n\n        /* Filling and unfilling the arc */\n        @-webkit-keyframes fillunfill {\n            from {\n                stroke-dashoffset: 58.8 /* 2*RADIUS*PI * ARCSIZE/360 - 0.1 */\n                /* 0.1 a bit of a magic constant here */\n            }\n            50% {\n                stroke-dashoffset: 0;\n            }\n            to {\n                stroke-dashoffset: -58.4 /* -(2*RADIUS*PI * ARCSIZE/360 - 0.5) */\n                /* 0.5 a bit of a magic constant here */\n            }\n        }\n        @-moz-keyframes fillunfill {\n            from {\n                stroke-dashoffset: 58.8 /* 2*RADIUS*PI * ARCSIZE/360 - 0.1 */\n                /* 0.1 a bit of a magic constant here */\n            }\n            50% {\n                stroke-dashoffset: 0;\n            }\n            to {\n                stroke-dashoffset: -58.4 /* -(2*RADIUS*PI * ARCSIZE/360 - 0.5) */\n                /* 0.5 a bit of a magic constant here */\n            }\n        }\n        @-webkit-keyframes rot {\n            from {\n                -webkit-transform: rotate(0deg);\n            }\n            to {\n                -webkit-transform: rotate(-360deg);\n            }\n        }\n        @-moz-keyframes rot {\n            from {\n                -webkit-transform: rotate(0deg);\n            }\n            to {\n                -webkit-transform: rotate(-360deg);\n            }\n        }\n        @-moz-keyframes colors {\n            0% {\n                stroke: #4285F4;\n            }\n            25% {\n                stroke: #DE3E35;\n            }\n            50% {\n                stroke: #F7C223;\n            }\n            75% {\n                stroke: #1B9A59;\n            }\n            100% {\n                stroke: #4285F4;\n            }\n        }\n\n        @-webkit-keyframes colors {\n            0% {\n                stroke: #4285F4;\n            }\n            25% {\n                stroke: #DE3E35;\n            }\n            50% {\n                stroke: #F7C223;\n            }\n            75% {\n                stroke: #1B9A59;\n            }\n            100% {\n                stroke: #4285F4;\n            }\n        }\n\n        @keyframes colors {\n            0% {\n                stroke: #4285F4;\n            }\n            25% {\n                stroke: #DE3E35;\n            }\n            50% {\n                stroke: #F7C223;\n            }\n            75% {\n                stroke: #1B9A59;\n            }\n            100% {\n                stroke: #4285F4;\n            }\n        }\n        .qp-circular-loader-path {\n            -webkit-animation-name: fillunfill, rot, colors;\n            -webkit-animation-duration: 1333ms, 5332ms, 5332ms; /* ARCTIME, 4*ARCTIME, 4*ARCTIME */\n            -webkit-animation-iteration-count: infinite, infinite, infinite;\n            -webkit-animation-timing-function: cubic-bezier(0.4, 0.0, 0.2, 1), steps(4), linear;\n            -webkit-animation-play-state: running, running, running;\n            -webkit-animation-fill-mode: forwards;\n\n            -moz-animation-name: fillunfill, rot, colors;\n            -moz-animation-duration: 1333ms, 5332ms, 5332ms; /* ARCTIME, 4*ARCTIME, 4*ARCTIME */\n            -moz-animation-iteration-count: infinite, infinite, infinite;\n            -moz-animation-timing-function: cubic-bezier(0.4, 0.0, 0.2, 1), steps(4), linear;\n            -moz-animation-play-state: running, running, running;\n            -moz-animation-fill-mode: forwards;\n        }\n\n    </style>\n\n    <!-- 3= STROKEWIDTH -->\n    <!-- 14= RADIUS + STROKEWIDTH/2 -->\n    <!-- 12.5= RADIUS -->\n    <!-- 1.5=  STROKEWIDTH/2 -->\n    <!-- ARCSIZE would affect the 1.5,14 part of this... 1.5,14 is specific to\n         270 degress -->\n    <g class=\"qp-circular-loader\">\n        <path class=\"qp-circular-loader-path\" fill=\"none\" d=\"M 14,1.5 A 12.5,12.5 0 1 1 1.5,14\" stroke-width=\"3\" stroke-linecap=\"round\"/>\n    </g>\n</svg>");
$templateCache.put("noAvailableHours.html","<span class=\"angular-reservation-noAvailableHours\">{{::\"noAvailableHours\" | translate}}</span>\r\n{{::reservationCtrl.availableHoursMessage}}\r\n<div uib-alert class=\"alert-danger text-center\" ng-if=\"reservationCtrl.reservationStatus == \'Error\'\" style=\"margin-top: 1em\">\r\n  <div ng-if=\"reservationCtrl.reservationMessage\">{{::reservationCtrl.reservationMessage}}</div>\r\n  <span>Please contact your financial institution for support.</span>\r\n</div>\r\n<div class=\"buffer-bottom text-center\" style=\"width:100%\">\r\n  <a class=\"btn btn-purchase\" ng-click=\"reservationCtrl.selectAnotherDate()\">« Select another date</a>\r\n</div>");}]);