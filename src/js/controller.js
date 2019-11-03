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
            console.log(product.integration.fields.currency)
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
            console.log('f')
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